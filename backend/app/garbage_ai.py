import json
import os
import re
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, Optional, Sequence, Tuple
from urllib import error as urlerror
from urllib import request as urlrequest


# The frontend stores a city boundary only, not ward polygons.
# These ward centers are therefore an explicit nearest-centroid approximation.
WARD_CENTROIDS: Dict[str, Tuple[float, float]] = {
    "Laxmi Nagar": (21.1255, 79.0680),
    "Dharampeth": (21.1426, 79.0559),
    "Hanuman Nagar": (21.1189, 79.1039),
    "Dhantoli": (21.1299, 79.0798),
    "Nehru Nagar": (21.1150, 79.1180),
    "Gandhi Baugh": (21.1550, 79.1050),
    "Sataranjipura": (21.1620, 79.1120),
    "Lakadganj": (21.1520, 79.1320),
    "Ashi Nagar": (21.1780, 79.1200),
    "Mangalwari": (21.1710, 79.0720),
}

WARD_ORDER = list(WARD_CENTROIDS.keys())
GARBAGE_DUPLICATE_RADIUS_METERS = 150.0
GARBAGE_REQUEST_RADIUS_METERS = 200.0
ACTIVE_HOTSPOT_RECENCY_DAYS = 30
AI_MATCH_CONFIDENCE_BAR = 0.7

GARBAGE_CATEGORY_LABELS = {
    "overflowing_bin": "Overflowing bin",
    "illegal_dumping": "Illegal dumping",
    "no_bin_nearby": "No bin nearby",
    "uncollected_garbage": "Uncollected garbage",
    "other": "Garbage issue",
}


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * \
        cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius_km * 1000.0 * asin(sqrt(a))


def resolve_ward_from_coordinates(latitude: Optional[float], longitude: Optional[float]) -> str:
    if latitude is None or longitude is None:
        return "Unspecified"

    nearest_ward = "Unspecified"
    nearest_distance = float("inf")
    for ward_name, (ward_lat, ward_lon) in WARD_CENTROIDS.items():
        distance = haversine_meters(latitude, longitude, ward_lat, ward_lon)
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_ward = ward_name
    return nearest_ward


def infer_garbage_category(description: str) -> str:
    text = description.lower()
    if any(keyword in text for keyword in ["overflow", "overflowing", "full bin", "bin full", "dustbin full"]):
        return "overflowing_bin"
    if any(keyword in text for keyword in ["dumping", "illegal dump", "garbage pile", "rubbish dumped", "trash dumped"]):
        return "illegal_dumping"
    if any(keyword in text for keyword in ["no bin", "need bin", "missing bin", "not enough bin", "few bins"]):
        return "no_bin_nearby"
    if any(keyword in text for keyword in ["not collected", "uncollected", "pickup missed", "collection missed", "pending pickup"]):
        return "uncollected_garbage"
    return "other"


def build_hotspot_title(category: str, ward_name: str, description: str) -> str:
    label = GARBAGE_CATEGORY_LABELS.get(
        category, GARBAGE_CATEGORY_LABELS["other"])
    if ward_name and ward_name != "Unspecified":
        return f"{label} near {ward_name}"
    first_phrase = description.strip().split(".")[0].strip()
    return first_phrase[:80] if first_phrase else label


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
    return None


def _call_anthropic_json(prompt: str) -> Optional[Dict[str, Any]]:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
    body = json.dumps({
        "model": model,
        "max_tokens": 300,
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    req = urlrequest.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=12) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            content = payload.get("content", [])
            text = "".join(chunk.get("text", "")
                           for chunk in content if isinstance(chunk, dict))
            return _extract_json_object(text)
    except (urlerror.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return None


def classify_report_against_candidates(
    description: str,
    ward_name: str,
    latitude: Optional[float],
    longitude: Optional[float],
    candidates: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    if not candidates:
        return {
            "same_issue": False,
            "confidence": 0.0,
            "reasoning": "No nearby active hotspot candidates were found.",
            "category": infer_garbage_category(description),
            "matched_hotspot_id": None,
        }

    candidate_lines = []
    for idx, candidate in enumerate(candidates, start=1):
        candidate_lines.append(
            f"Candidate {idx}: id={candidate['id']}; title={candidate['title']}; category={candidate.get('category') or 'other'}; "
            f"distance_meters={candidate['distance_meters']:.1f}; last_report_description={candidate['last_report_description']}"
        )

    prompt = (
        "You are helping a municipal audit system deduplicate citizen garbage complaints. "
        f"A new complaint was just filed in {ward_name} ward: \"{description}\". "
        f"Its approximate coordinates are {latitude}, {longitude}. "
        "Compare it to the nearby open hotspot candidates below and decide whether it is the same underlying issue. "
        "Respond with strict JSON only: {\"same_issue\": true|false, \"confidence\": 0.0-1.0, \"reasoning\": \"one sentence\", \"matched_hotspot_id\": \"candidate id or null\", \"category\": \"overflowing_bin|illegal_dumping|no_bin_nearby|uncollected_garbage|other\"}.\n\n"
        + "\n".join(candidate_lines)
    )

    response = _call_anthropic_json(prompt)
    if response:
        response.setdefault("category", infer_garbage_category(description))
        response.setdefault("matched_hotspot_id", None)
        return response

    best_match: Optional[Dict[str, Any]] = None
    best_score = 0.0
    new_category = infer_garbage_category(description)
    description_terms = set(re.findall(r"[a-z0-9]+", description.lower()))

    for candidate in candidates:
        candidate_terms = set(re.findall(
            r"[a-z0-9]+", f"{candidate['title']} {candidate['last_report_description']}".lower()))
        overlap = len(description_terms & candidate_terms)
        distance_score = max(
            0.0, 1.0 - (candidate["distance_meters"] / max(GARBAGE_DUPLICATE_RADIUS_METERS, 1.0)))
        score = min(1.0, (overlap / 8.0) + distance_score)
        if score > best_score:
            best_score = score
            best_match = candidate

    if best_match and best_score >= 0.65:
        return {
            "same_issue": True,
            "confidence": round(best_score, 2),
            "reasoning": "Heuristic proximity and text overlap indicate the same underlying issue.",
            "matched_hotspot_id": best_match["id"],
            "category": best_match.get("category") or new_category,
        }

    return {
        "same_issue": False,
        "confidence": round(best_score, 2),
        "reasoning": "No strong duplicate match was found, so a new hotspot should be created.",
        "matched_hotspot_id": None,
        "category": new_category,
    }


def classify_dustbin_request(
    area_description: str,
    reason: str,
    ward_name: str,
    latitude: Optional[float],
    longitude: Optional[float],
    candidates: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    if not candidates:
        return {
            "same_request": False,
            "confidence": 0.0,
            "reasoning": "No nearby pending request exists.",
        }

    best_candidate = min(candidates, key=lambda item: item["distance_meters"])
    combined_text = f"{area_description} {reason}".lower()
    candidate_text = f"{best_candidate['area_description']} {best_candidate['reason']}".lower(
    )
    overlap = len(set(re.findall(r"[a-z0-9]+", combined_text))
                  & set(re.findall(r"[a-z0-9]+", candidate_text)))
    confidence = min(1.0, (overlap / 10.0) + max(0.0, 1.0 -
                     best_candidate["distance_meters"] / GARBAGE_REQUEST_RADIUS_METERS))

    return {
        "same_request": confidence >= 0.6,
        "confidence": round(confidence, 2),
        "reasoning": "Nearby request with similar locality description was grouped.",
        "matched_request_id": best_candidate["id"] if confidence >= 0.6 else None,
    }
