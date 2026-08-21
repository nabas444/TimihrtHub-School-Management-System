import { Router } from "express";
import locationsRouter from "./inventory.locations.routes";
import categoriesRouter from "./inventory.categories.routes";
import suppliersRouter from "./inventory.suppliers.routes";
import itemsRouter from "./inventory.items.routes";
import allocationsRouter from "./inventory.allocations.routes";
import goodsReceiptsRouter from "./inventory.goods-receipts.routes";
import movementsRouter from "./inventory.movements.routes";
import requestsRouter from "./inventory.requests.routes";
import purchaseOrdersRouter from "./inventory.purchase-orders.routes";
import maintenanceRouter from "./inventory.maintenance.routes";
import disposalRouter from "./inventory.disposal.routes";
import stockCountsRouter from "./inventory.stock-counts.routes";

const router = Router();

// Phase 1 Sub-routers
router.use("/locations", locationsRouter);
router.use("/categories", categoriesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/items", itemsRouter);

// Phase 2 Sub-routers
router.use("/allocations", allocationsRouter);
router.use("/goods-receipts", goodsReceiptsRouter);
router.use("/movements", movementsRouter);

// Phase 3 Sub-routers
router.use("/requests", requestsRouter);
router.use("/purchase-orders", purchaseOrdersRouter);

// Phase 4 Sub-routers
router.use("/maintenance", maintenanceRouter);
router.use("/disposal", disposalRouter);
router.use("/stock-counts", stockCountsRouter);

export default router;
