import api from "../../lib/api";

// ── Hostels & Structure ────────────────────────────────────────────────────────
export const getHostels = (params) => api.get("/hostels", { params }).then((r) => r.data);
export const getHostelById = (id) => api.get(`/hostels/${id}`).then((r) => r.data);
export const createHostel = (data) => api.post("/hostels", data).then((r) => r.data);
export const updateHostel = (id, data) => api.patch(`/hostels/${id}`, data).then((r) => r.data);
export const deleteHostel = (id) => api.delete(`/hostels/${id}`).then((r) => r.data);
export const getHostelOccupancy = (id) => api.get(`/hostels/${id}/occupancy`).then((r) => r.data);

// ── Blocks, Rooms, Beds ────────────────────────────────────────────────────────
export const createBlock = (hostelId, data) => api.post(`/hostels/${hostelId}/blocks`, data).then((r) => r.data);
export const getBlocks = (hostelId) => api.get(`/hostels/${hostelId}/blocks`).then((r) => r.data);
export const updateBlock = (blockId, data) => api.patch(`/hostels/blocks/${blockId}`, data).then((r) => r.data);
export const deleteBlock = (blockId) => api.delete(`/hostels/blocks/${blockId}`).then((r) => r.data);

export const createRoom = (blockId, data) => api.post(`/hostels/blocks/${blockId}/rooms`, data).then((r) => r.data);
export const getRooms = (blockId, params) => api.get(`/hostels/blocks/${blockId}/rooms`, { params }).then((r) => r.data);
export const updateRoom = (roomId, data) => api.patch(`/hostels/rooms/${roomId}`, data).then((r) => r.data);
export const deleteRoom = (roomId) => api.delete(`/hostels/rooms/${roomId}`).then((r) => r.data);

export const createBed = (roomId, data) => api.post(`/hostels/rooms/${roomId}/beds`, data).then((r) => r.data);
export const bulkCreateBeds = (roomId, data) => api.post(`/hostels/rooms/${roomId}/beds/bulk`, data).then((r) => r.data);
export const updateBed = (bedId, data) => api.patch(`/hostels/beds/${bedId}`, data).then((r) => r.data);
export const deleteBed = (bedId) => api.delete(`/hostels/beds/${bedId}`).then((r) => r.data);

// ── Applications & Allocation ─────────────────────────────────────────────────
export const submitHostelApplication = (data) => api.post("/hostels/applications", data).then((r) => r.data);
export const getHostelApplications = (params) => api.get("/hostels/applications", { params }).then((r) => r.data);
export const reviewHostelApplication = (id, data) => api.patch(`/hostels/applications/${id}/review`, data).then((r) => r.data);

export const runAutoAllocation = (hostelId, data) => api.post(`/hostels/${hostelId}/allocate/run`, data).then((r) => r.data);
export const manualAllocate = (data) => api.post("/hostels/allocations", data).then((r) => r.data);
export const checkInResident = (id) => api.post(`/hostels/allocations/${id}/check-in`).then((r) => r.data);
export const checkOutResident = (id, data) => api.post(`/hostels/allocations/${id}/check-out`, data).then((r) => r.data);
export const getStudentAllocationHistory = (studentId) => api.get(`/hostels/students/${studentId}/allocations`).then((r) => r.data);

// ── Daily Operations (Attendance, Outpasses, Visitors) ─────────────────────────
export const recordNightAttendance = (hostelId, data) => api.post(`/hostels/${hostelId}/night-attendance`, data).then((r) => r.data);
export const getNightAttendanceGrid = (hostelId, params) => api.get(`/hostels/${hostelId}/night-attendance`, { params }).then((r) => r.data);

export const createOutpass = (data) => api.post("/hostels/outpasses", data).then((r) => r.data);
export const getOutpasses = (params) => api.get("/hostels/outpasses", { params }).then((r) => r.data);
export const decideOutpass = (id, data) => api.patch(`/hostels/outpasses/${id}/decide`, data).then((r) => r.data);
export const scanGateOut = (id) => api.post(`/hostels/outpasses/${id}/gate-out`).then((r) => r.data);
export const scanGateIn = (id) => api.post(`/hostels/outpasses/${id}/gate-in`).then((r) => r.data);

export const logVisitorCheckIn = (data) => api.post("/hostels/visitor-logs", data).then((r) => r.data);
export const getVisitorLogs = (params) => api.get("/hostels/visitor-logs", { params }).then((r) => r.data);
export const logVisitorCheckOut = (id) => api.patch(`/hostels/visitor-logs/${id}/checkout`).then((r) => r.data);

// ── Care, Maintenance, Incidents, Transfers ───────────────────────────────────
export const createMaintenanceTicket = (data) => api.post("/hostels/maintenance-tickets", data).then((r) => r.data);
export const getMaintenanceTickets = (params) => api.get("/hostels/maintenance-tickets", { params }).then((r) => r.data);
export const updateMaintenanceTicket = (id, data) => api.patch(`/hostels/maintenance-tickets/${id}`, data).then((r) => r.data);

export const createIncidentReport = (data) => api.post("/hostels/incident-reports", data).then((r) => r.data);
export const getIncidentReports = (params) => api.get("/hostels/incident-reports", { params }).then((r) => r.data);

export const createTransferRequest = (data) => api.post("/hostels/transfer-requests", data).then((r) => r.data);
export const getTransferRequests = (params) => api.get("/hostels/transfer-requests", { params }).then((r) => r.data);
export const decideTransferRequest = (id, data) => api.patch(`/hostels/transfer-requests/${id}/decide`, data).then((r) => r.data);
