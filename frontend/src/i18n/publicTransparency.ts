export type Language = 'en' | 'hi' | 'mr';

export interface TimelineEventTranslation {
  date: string;
  title: string;
  desc: string;
}

export interface PublicTransparencyDictionary {
  // Header
  immutableAuditRecords: string;
  publicLedger: string;
  publicAccessChannel: string;

  // Alert Banner
  activeForensicInquiry: string;
  inquiryNotice: string;

  // Contractor Compliance Leaderboard
  contractorComplianceLeaderboard: string;
  rank: string;
  contractor: string;
  complianceScore: string;
  grade: string;

  // Grade Descriptions
  gradeFDesc: string;
  gradeDMinusDesc: string;
  gradeCPlusDesc: string;
  gradeBDesc: string;

  // Sealed Records Section
  immutableOnChainAudit: string;
  recentlySealedExhibits: string;
  refresh: string;
  queryingLogs: string;
  noSealedRecords: string;

  // Garbage Reports Section
  garbageReportsSection: string;
  garbageReportsSubtitle: string;

  // Record Item Labels & Notes
  weighTicketPrefix: string;
  roadRestorationPrefix: string;
  contractorFallback: string;
  verifiedOnChain: string;
  slaComplianceVerified: (complaintsCount: number) => string;
  txPrefix: string;

  // Status Labels
  status: {
    confirmed_fraud: string;
    cleared: string;
    verified: string;
    [key: string]: string;
  };

  // Inquiry Chronology Timeline
  inquiryChronology: string;
  timelineEvents: TimelineEventTranslation[];
}

export const publicTransparencyTranslations: Record<Language, PublicTransparencyDictionary> = {
  en: {
    immutableAuditRecords: "Immutable Audit Records",
    publicLedger: "Public Ledger",
    publicAccessChannel: "Public Access Channel — Municipal Compliance Record. All weighbridge tickets shown on this portal are cryptographically locked on-chain and cannot be edited.",

    activeForensicInquiry: "Active Forensic Inquiry: IN PROGRESS",
    inquiryNotice: "The Nagpur Municipal Corporation has ordered a formal inquiry into waste collection invoicing from April–July 2026. TrashTrail provides tamper-proof blockchain evidence logs to investigation committees.",

    contractorComplianceLeaderboard: "Contractor Compliance Leaderboard",
    rank: "Rank",
    contractor: "Contractor",
    complianceScore: "Compliance Score",
    grade: "Grade",

    gradeFDesc: "Multiple confirmed fraud violations sealed on-chain. Severe weight duplication anomalies.",
    gradeDMinusDesc: "Active forensic inquiry over 6,400+ MT unexplained tonnage drop and spatial GPS contradictions.",
    gradeCPlusDesc: "Road repair restorations triggered automated SLA holds in Dharampeth.",
    gradeBDesc: "Compliance metrics within baseline parameters.",

    immutableOnChainAudit: "Immutable On-Chain Audit",
    recentlySealedExhibits: "Recently sealed exhibits on EVM",
    refresh: "Refresh",
    queryingLogs: "Querying Smart Contract Event Logs...",
    noSealedRecords: "No sealed blockchain exhibits registered yet.",

    garbageReportsSection: "Garbage & Sanitation Reports",
    garbageReportsSubtitle: "Ranked by report volume and grouped by ward for public review.",

    weighTicketPrefix: "Weigh Ticket",
    roadRestorationPrefix: "Road Restoration",
    contractorFallback: "Contractor",
    verifiedOnChain: "Verified on-chain",
    slaComplianceVerified: (count: number) => `SLA Compliance Verified (${count} complaints)`,
    txPrefix: "Tx:",

    status: {
      confirmed_fraud: "confirmed_fraud",
      cleared: "cleared",
      verified: "verified"
    },

    inquiryChronology: "Inquiry Chronology (2026)",
    timelineEvents: [
      {
        date: "April 1, 2026",
        title: "Monitoring Systems Activated",
        desc: "NMC launches digital weighbridge ticketing tracking under new contractor guidelines."
      },
      {
        date: "May 20, 2026",
        title: "First GPS Discrepancies Flagged",
        desc: "TrashTrail flags multiple trips where registered truck dump weight has zero corresponding dump site GPS entries."
      },
      {
        date: "June 15, 2026",
        title: "Suspicious Weight Pattern Allegations",
        desc: "Citizen groups publish weighbridge logs showing exact repeating heavy weights registered by BVG India trucks."
      },
      {
        date: "July 12, 2026",
        title: "Formal Waste Collection Inquiry Ordered",
        desc: "NMC Commissioner orders full forensic audit over 6,400+ MT sudden drop in monthly garbage tonnage billing."
      },
      {
        date: "August 15, 2026",
        title: "TrashTrail Public Dashboard Released",
        desc: "Platform opened for public scrutiny to allow citizens to trace locked municipal waste tickets and report road SLA breaches."
      }
    ]
  },

  hi: {
    immutableAuditRecords: "अपरिवर्तनीय ऑडिट रिकॉर्ड",
    publicLedger: "सार्वजनिक लेज़र",
    publicAccessChannel: "सार्वजनिक पहुंच चैनल — नगर निगम अनुपालन रिकॉर्ड। इस पोर्टल पर प्रदर्शित सभी वेज-ब्रिज टिकट ब्लॉकचेन पर सुरक्षित (क्रिप्टोग्राफिकली लॉक) हैं और इनमें कोई बदलाव नहीं किया जा सकता।",

    activeForensicInquiry: "सक्रिय फोरेंसिक जांच: प्रगति पर है",
    inquiryNotice: "नागपुर नगर निगम ने अप्रैल-जुलाई 2026 के कचरा संग्रहण चालान (इनवॉइसिंग) की औपचारिक जांच के आदेश दिए हैं। ट्रैशट्रेल (TrashTrail) जांच समितियों को छेड़छाड़-मुक्त ब्लॉकचेन साक्ष्य लॉग प्रदान करता है।",

    contractorComplianceLeaderboard: "ठेकेदार अनुपालन लीडरबोर्ड",
    rank: "रैंक",
    contractor: "ठेकेदार",
    complianceScore: "अनुपालन स्कोर",
    grade: "ग्रेड",

    gradeFDesc: "ऑन-चेन सील किए गए कई पुष्ट धोखाधड़ी उल्लंघन। गंभीर वजन दोहराव विसंगतियां।",
    gradeDMinusDesc: "6,400+ मीट्रिक टन अस्पष्ट वजन गिरावट और स्थानिक जीपीएस विसंगतियों पर सक्रिय फोरेंसिक जांच।",
    gradeCPlusDesc: "धरमपेठ में सड़क मरम्मत कार्यों पर स्वचालित एसएलए रोक लगाई गई।",
    gradeBDesc: "अनुपालन मानक सामान्य मापदंडों के भीतर हैं।",

    immutableOnChainAudit: "अपरिवर्तनीय ऑन-चेन ऑडिट",
    recentlySealedExhibits: "ईवीएम पर हाल ही में सील किए गए साक्ष्य",
    refresh: "रिफ्रेश करें",
    queryingLogs: "स्मार्ट कॉन्ट्रैक्ट इवेंट लॉग खोजे जा रहे हैं...",
    noSealedRecords: "अभी तक कोई सीलबंद ब्लॉकचेन साक्ष्य पंजीकृत नहीं है।",

    garbageReportsSection: "कचरा और स्वच्छता रिपोर्ट",
    garbageReportsSubtitle: "रिपोर्ट मात्रा के अनुसार क्रमबद्ध और वार्ड के अनुसार समूहित सार्वजनिक दृश्य।",

    weighTicketPrefix: "वजन पर्ची",
    roadRestorationPrefix: "सड़क मरम्मत",
    contractorFallback: "ठेकेदार",
    verifiedOnChain: "ऑन-चेन सत्यापित",
    slaComplianceVerified: (count: number) => `एसएलए अनुपालन सत्यापित (${count} शिकायतें)`,
    txPrefix: "Tx:",

    status: {
      confirmed_fraud: "पुष्ट धोखाधड़ी",
      cleared: "स्वीकृत",
      verified: "सत्यापित"
    },

    inquiryChronology: "जांच का घटनाक्रम (2026)",
    timelineEvents: [
      {
        date: "1 अप्रैल 2026",
        title: "निगरानी प्रणाली सक्रिय",
        desc: "मनपा ने नए ठेकेदार दिशानिर्देशों के तहत डिजिटल वेज-ब्रिज टिकटिंग ट्रैकिंग शुरू की।"
      },
      {
        date: "20 मई 2026",
        title: "पहली जीपीएस विसंगतियां चिह्नित",
        desc: "ट्रैशट्रेल ने कई फेरों को चिह्नित किया जहां पंजीकृत ट्रक डंप वजन की डंप स्थल पर कोई संगत जीपीएस प्रविष्टि नहीं है।"
      },
      {
        date: "15 जून 2026",
        title: "संदिग्ध वजन पैटर्न के आरोप",
        desc: "नागरिक समूहों ने वेज-ब्रिज लॉग प्रकाशित किए जिसमें बीवीजी इंडिया के ट्रकों द्वारा दर्ज सटीक रूप से दोहराए गए भारी वजन दिखाए गए हैं।"
      },
      {
        date: "12 जुलाई 2026",
        title: "कचरा संग्रहण की औपचारिक जांच के आदेश",
        desc: "मनपा आयुक्त ने मासिक कचरा टनेज बिलिंग में 6,400+ मीट्रिक टन की अचानक गिरावट पर पूर्ण फोरेंसिक ऑडिट का आदेश दिया।"
      },
      {
        date: "15 अगस्त 2026",
        title: "ट्रैशट्रेल (TrashTrail) पब्लिक डैशबोर्ड जारी",
        desc: "नागरिकों को लॉक किए गए नगरपालिका अपशिष्ट टिकटों को ट्रैक करने और सड़क एसएलए उल्लंघनों की रिपोर्ट करने के लिए सार्वजनिक मंच खोला गया।"
      }
    ]
  },

  mr: {
    immutableAuditRecords: "अपरिवर्तनीय ऑडिट नोंदी",
    publicLedger: "सार्वजनिक नोंदवही",
    publicAccessChannel: "सार्वजनिक प्रवेश चॅनेल — मनपा अनुपालन नोंद. या पोर्टलवर दर्शविलेल्या सर्व वे-ब्रिज पावत्या ब्लॉकचेनवर सुरक्षित (क्रिप्टोग्राफिकली लॉक) असून त्यामध्ये कोणताही बदल केला जाऊ शकत नाही.",

    activeForensicInquiry: "सक्रिय फॉरेन्सिक चौकशी: प्रगतीपथावर",
    inquiryNotice: "नागपूर महानगरपालिकेने एप्रिल-जुलै २०२६ दरम्यानच्या कचरा संकलन इनव्हॉइसिंगच्या औपचारिक चौकशीचे आदेश दिले आहेत। ट्रॅशट्रेल (TrashTrail) तपास समित्यांना छेडछाड-मुक्त ब्लॉकचेन पुरावे नोंदी पुरवते.",

    contractorComplianceLeaderboard: "कंत्राटदार अनुपालन लीडरबोर्ड",
    rank: "क्रमांक",
    contractor: "कंत्राटदार",
    complianceScore: "अनुपालन गुण",
    grade: "श्रेणी",

    gradeFDesc: "ऑन-चेन सील केलेले अनेक पुष्टी झालेले फसवणूक उल्लंघन. वजनात गंभीर डुप्लिकेशन त्रुटी.",
    gradeDMinusDesc: "६,४००+ मेट्रिक टन वजनातील अस्पष्ट घट आणि स्थानिक जीपीएस विसंगतींवर सक्रिय फॉरेन्सिक चौकशी सुरू.",
    gradeCPlusDesc: "धरमपेठमधील रस्ते दुरुस्ती कामांवर स्वयंचलित एसएलए रोख (होल्ड) लागू.",
    gradeBDesc: "अनुपालन निकष आधारभूत मर्यादेत आहेत.",

    immutableOnChainAudit: "अपरिवर्तनीय ऑन-चेन ऑडिट",
    recentlySealedExhibits: "ईव्हीएमवर नुकतेच सील केलेले पुरावे",
    refresh: "रिफ्रेश करा",
    queryingLogs: "स्मार्ट कॉन्ट्रॅक्ट इव्हेंट लॉग तपासत आहे...",
    noSealedRecords: "अद्याप कोणतेही सील केलेले ब्लॉकचेन पुरावे नोंदवलेले नाहीत.",

    garbageReportsSection: "कचरा आणि स्वच्छता अहवाल",
    garbageReportsSubtitle: "अहवालांच्या संख्येनुसार क्रमांकित आणि वार्डनुसार गटबद्ध सार्वजनिक दृश्य.",

    weighTicketPrefix: "वजन पावती",
    roadRestorationPrefix: "रस्ता दुरुस्ती",
    contractorFallback: "कंत्राटदार",
    verifiedOnChain: "ऑन-चेन पडताळणीकृत",
    slaComplianceVerified: (count: number) => `एसएलए अनुपालन पडताळणीकृत (${count} तक्रारी)`,
    txPrefix: "Tx:",

    status: {
      confirmed_fraud: "पुष्टी झालेली फसवणूक",
      cleared: "मंजूर",
      verified: "पडताळणीकृत"
    },

    inquiryChronology: "चौकशीचा घटनाक्रम (२०२६)",
    timelineEvents: [
      {
        date: "१ एप्रिल २०२६",
        title: "निगरानी प्रणाली कार्यान्वित",
        desc: "मनपाने नवीन कंत्राटदार मार्गदर्शक तत्त्वांनुसार डिजिटल वे-ब्रिज तिकीट ट्रॅकिंग सुरू केले."
      },
      {
        date: "२० मे २०२६",
        title: "पहिली जीपीएस विसंगती निदर्शनास",
        desc: "ट्रॅशट्रेलने अशा अनेक फेऱ्या चिन्हांकित केल्या जेथे नोंदणीकृत ट्रक डंप वजनाची डंप साईटवर कोणतीही जीपीएस नोंद नाही."
      },
      {
        date: "१५ जून २०२६",
        title: "संशयास्पद वजन पॅटर्नचे आरोप",
        desc: "नागरिक गटांनी वे-ब्रिज लॉग प्रसिद्ध केले ज्यात बीव्हीजी इंडिया ट्रक्सद्वारे नोंदवलेले तंतोतंत पुनरावृत्ती होणारे जड वजन दिसून आले."
      },
      {
        date: "१२ जुलै २०२६",
        title: "कचरा संकलनाची औपचारिक चौकशी करण्याचे आदेश",
        desc: "मनपा आयुक्तांनी मासिक कचरा टनेज बिलिंगमध्ये ६,४००+ मेट्रिक टन अचानक झालेल्या घटीवर पूर्ण फॉरेन्सिक ऑडिटचे आदेश दिले."
      },
      {
        date: "१५ ऑगस्ट २०२६",
        title: "ट्रॅशट्रेल (TrashTrail) सार्वजनिक डॅशबोर्ड सुरू",
        desc: "नागरिकांना महापालिकेच्या कचरा पावत्या तपासण्यासाठी आणि रस्ते एसएलए उल्लंघनाची तक्रार करण्यासाठी सार्वजनिक व्यासपीठ खुले केले."
      }
    ]
  }
};
