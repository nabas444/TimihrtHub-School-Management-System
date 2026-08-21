import { Router } from "express";
import locationsRouter from "./inventory.locations.routes";
import categoriesRouter from "./inventory.categories.routes";
import suppliersRouter from "./inventory.suppliers.routes";
import itemsRouter from "./inventory.items.routes";

const router = Router();

// Phase 1 Sub-routers
router.use("/locations", locationsRouter);
router.use("/categories", categoriesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/items", itemsRouter);

export default router;
