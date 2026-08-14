-- CreateTable
CREATE TABLE "_AssignedClasses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AssignedClasses_AB_unique" ON "_AssignedClasses"("A", "B");

-- CreateIndex
CREATE INDEX "_AssignedClasses_B_index" ON "_AssignedClasses"("B");

-- AddForeignKey
ALTER TABLE "_AssignedClasses" ADD CONSTRAINT "_AssignedClasses_A_fkey" FOREIGN KEY ("A") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedClasses" ADD CONSTRAINT "_AssignedClasses_B_fkey" FOREIGN KEY ("B") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
