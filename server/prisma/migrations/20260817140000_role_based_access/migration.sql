-- AlterTable: User gets real role/permission/invite-account support
ALTER TABLE `User`
    ADD COLUMN `permissions` JSON NULL,
    ADD COLUMN `staff_id` VARCHAR(191) NULL,
    ADD COLUMN `reseller_id` VARCHAR(191) NULL,
    ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'customer';

-- Migrate existing role values to the new naming
UPDATE `User` SET `role` = 'super_admin' WHERE `role` = 'admin';
UPDATE `User` SET `role` = 'customer' WHERE `role` = 'user';

-- AlterTable: Reseller can now be linked to a login account
ALTER TABLE `Reseller`
    ADD COLUMN `user_id` VARCHAR(191) NULL;
