-- AlterTable
ALTER TABLE `User` MODIFY `password_hash` VARCHAR(191) NULL,
    ADD COLUMN `google_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_google_id_key` ON `User`(`google_id`);
