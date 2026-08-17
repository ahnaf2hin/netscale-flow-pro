-- AlterTable
ALTER TABLE `OLTDevice`
    ADD COLUMN `snmp_port` INTEGER NOT NULL DEFAULT 161,
    ADD COLUMN `oid_profile` VARCHAR(191) NOT NULL DEFAULT 'huawei_ma5600',
    ADD COLUMN `custom_status_oid` VARCHAR(191) NULL,
    ADD COLUMN `custom_serial_oid` VARCHAR(191) NULL,
    ADD COLUMN `custom_rx_power_oid` VARCHAR(191) NULL,
    ADD COLUMN `custom_tx_power_oid` VARCHAR(191) NULL,
    ADD COLUMN `custom_power_divisor` DOUBLE NOT NULL DEFAULT 100,
    ADD COLUMN `low_signal_threshold_dbm` DOUBLE NOT NULL DEFAULT -27;

-- CreateTable
CREATE TABLE `OnuOpticalLog` (
    `id` VARCHAR(191) NOT NULL,
    `olt_id` VARCHAR(191) NOT NULL,
    `serial_number` VARCHAR(191) NOT NULL,
    `rx_power_dbm` DOUBLE NULL,
    `tx_power_dbm` DOUBLE NULL,
    `status` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OnuOpticalLog_olt_id_serial_number_created_date_idx`(`olt_id`, `serial_number`, `created_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
