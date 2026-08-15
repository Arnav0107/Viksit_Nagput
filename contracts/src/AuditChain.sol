// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditChain {
    address public owner;

    struct WeighbridgeRecord {
        string ticketId;
        string truckId;
        string contractor;
        uint256 weightKg;
        uint256 timestamp;
        string gpsRouteHash;
        string dataHash; // keccak256 hash of entire weighbridge and GPS record
        uint256 blockNumber;
        bool exists;
    }

    struct RoadRepairRecord {
        string repairId;
        string contractor;
        string wardName;
        string locationGps;
        string beforePhotoHash;
        string afterPhotoHash;
        uint256 workDate;
        uint256 slaExpiryDate;
        uint256 complaintsCount;
        uint256 blockNumber;
        bool exists;
    }

    // Mappings of Record ID -> Record details
    mapping(string => WeighbridgeRecord) private weighRecords;
    mapping(string => RoadRepairRecord) private roadRepairRecords;

    // Events
    event WeighbridgeRecordLocked(
        string indexed ticketId,
        string indexed truckId,
        string contractor,
        uint256 weightKg,
        string dataHash,
        uint256 timestamp
    );

    event RoadRepairRecordLocked(
        string indexed repairId,
        string contractor,
        string wardName,
        string beforePhotoHash,
        string afterPhotoHash,
        uint256 slaExpiryDate
    );

    event RoadRepairComplaintAdded(
        string indexed repairId,
        uint256 newComplaintsCount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditChain: Only owner/NMC administrator can call");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Locks a weighbridge ticket into the blockchain ledger.
     */
    function lockWeighbridgeRecord(
        string calldata _ticketId,
        string calldata _truckId,
        string calldata _contractor,
        uint256 _weightKg,
        uint256 _timestamp,
        string calldata _gpsRouteHash,
        string calldata _dataHash
    ) external onlyOwner {
        require(!weighRecords[_ticketId].exists, "AuditChain: Weighbridge record already locked");

        weighRecords[_ticketId] = WeighbridgeRecord({
            ticketId: _ticketId,
            truckId: _truckId,
            contractor: _contractor,
            weightKg: _weightKg,
            timestamp: _timestamp,
            gpsRouteHash: _gpsRouteHash,
            dataHash: _dataHash,
            blockNumber: block.number,
            exists: true
        });

        emit WeighbridgeRecordLocked(
            _ticketId,
            _truckId,
            _contractor,
            _weightKg,
            _dataHash,
            _timestamp
        );
    }

    /**
     * @dev Locks a road repair record under SLA tracking.
     */
    function lockRoadRepairRecord(
        string calldata _repairId,
        string calldata _contractor,
        string calldata _wardName,
        string calldata _locationGps,
        string calldata _beforePhotoHash,
        string calldata _afterPhotoHash,
        uint256 _workDate,
        uint256 _slaExpiryDate
    ) external onlyOwner {
        require(!roadRepairRecords[_repairId].exists, "AuditChain: Road repair record already locked");

        roadRepairRecords[_repairId] = RoadRepairRecord({
            repairId: _repairId,
            contractor: _contractor,
            wardName: _wardName,
            locationGps: _locationGps,
            beforePhotoHash: _beforePhotoHash,
            afterPhotoHash: _afterPhotoHash,
            workDate: _workDate,
            slaExpiryDate: _slaExpiryDate,
            complaintsCount: 0,
            blockNumber: block.number,
            exists: true
        });

        emit RoadRepairRecordLocked(
            _repairId,
            _contractor,
            _wardName,
            _beforePhotoHash,
            _afterPhotoHash,
            _slaExpiryDate
        );
    }

    /**
     * @dev Increments the citizen complaints count on a road repair.
     */
    function addRoadRepairComplaint(string calldata _repairId) external {
        require(roadRepairRecords[_repairId].exists, "AuditChain: Road repair record does not exist");
        roadRepairRecords[_repairId].complaintsCount += 1;

        emit RoadRepairComplaintAdded(_repairId, roadRepairRecords[_repairId].complaintsCount);
    }

    /**
     * @dev Retrieves locked weighbridge records for inspection and verification.
     */
    function getWeighbridgeRecord(string calldata _ticketId)
        external
        view
        returns (
            string memory ticketId,
            string memory truckId,
            string memory contractor,
            uint256 weightKg,
            uint256 timestamp,
            string memory gpsRouteHash,
            string memory dataHash,
            uint256 blockNumber,
            bool exists
        )
    {
        WeighbridgeRecord memory record = weighRecords[_ticketId];
        require(record.exists, "AuditChain: Weighbridge record not found");
        return (
            record.ticketId,
            record.truckId,
            record.contractor,
            record.weightKg,
            record.timestamp,
            record.gpsRouteHash,
            record.dataHash,
            record.blockNumber,
            record.exists
        );
    }

    /**
     * @dev Retrieves locked road repair records.
     */
    function getRoadRepairRecord(string calldata _repairId)
        external
        view
        returns (
            string memory repairId,
            string memory contractor,
            string memory wardName,
            string memory locationGps,
            string memory beforePhotoHash,
            string memory afterPhotoHash,
            uint256 workDate,
            uint256 slaExpiryDate,
            uint256 complaintsCount,
            uint256 blockNumber,
            bool exists
        )
    {
        RoadRepairRecord memory record = roadRepairRecords[_repairId];
        require(record.exists, "AuditChain: Road repair record not found");
        return (
            record.repairId,
            record.contractor,
            record.wardName,
            record.locationGps,
            record.beforePhotoHash,
            record.afterPhotoHash,
            record.workDate,
            record.slaExpiryDate,
            record.complaintsCount,
            record.blockNumber,
            record.exists
        );
    }
}
