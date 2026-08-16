-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    `otp_code` VARCHAR(191) NULL,
    `otp_expires` DATETIME(3) NULL,
    `reset_token` VARCHAR(191) NULL,
    `reset_token_expires` DATETIME(3) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `zone` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `connection_date` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `package_id` VARCHAR(191) NULL,
    `pppoe_username` VARCHAR(191) NULL,
    `pppoe_password` VARCHAR(191) NULL,
    `customer_code` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `provided_devices` TEXT NULL,
    `connection_charge` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `package_discount` DOUBLE NOT NULL DEFAULT 0,
    `referral` VARCHAR(191) NULL,
    `connected_by` VARCHAR(191) NULL,
    `free_connection` BOOLEAN NOT NULL DEFAULT false,
    `reseller_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    INDEX `Customer_email_idx`(`email`),
    INDEX `Customer_pppoe_username_idx`(`pppoe_username`),
    INDEX `Customer_status_idx`(`status`),
    INDEX `Customer_package_id_idx`(`package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NULL,
    `package_name` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `paid_amount` DOUBLE NOT NULL DEFAULT 0,
    `due_date` VARCHAR(191) NULL,
    `billing_month` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unpaid',
    `paid_date` VARCHAR(191) NULL,
    `payment_method` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    INDEX `Invoice_customer_id_idx`(`customer_id`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_billing_month_idx`(`billing_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `gateway` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `transaction_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `paid_at` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `collected_by` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_customer_id_idx`(`customer_id`),
    INDEX `Payment_invoice_id_idx`(`invoice_id`),
    INDEX `Payment_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `speed_mbps` DOUBLE NOT NULL,
    `monthly_price` DOUBLE NOT NULL,
    `validity_days` INTEGER NOT NULL DEFAULT 30,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentGateway` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'sslcommerz',
    `display_name` VARCHAR(191) NOT NULL,
    `api_key` VARCHAR(191) NULL,
    `secret_key` VARCHAR(191) NULL,
    `api_base` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'BDT',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsProvider` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'ssl_wireless',
    `display_name` VARCHAR(191) NOT NULL,
    `api_url` VARCHAR(191) NULL,
    `api_key` VARCHAR(191) NULL,
    `api_secret` VARCHAR(191) NULL,
    `sender_id` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SMSMessage` (
    `id` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `recipient_name` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'single',
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `sent_at` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MapSetting` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'esri',
    `google_maps_api_key` TEXT NULL,
    `google_map_type` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MikrotikRouter` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `api_port` INTEGER NOT NULL DEFAULT 8728,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `snmp_community` VARCHAR(191) NOT NULL DEFAULT 'public',
    `snmp_port` INTEGER NOT NULL DEFAULT 161,
    `location` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'offline',
    `last_synced` VARCHAR(191) NULL,
    `router_version` VARCHAR(191) NULL,
    `router_uptime` VARCHAR(191) NULL,
    `free_memory` DOUBLE NULL,
    `cpu_load` DOUBLE NULL,
    `board_name` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PPPoESession` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `customer_name` VARCHAR(191) NULL,
    `customer_code` VARCHAR(191) NULL,
    `router_id` VARCHAR(191) NOT NULL,
    `router_name` VARCHAR(191) NULL,
    `pppoe_username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `profile` VARCHAR(191) NULL,
    `secret_id` VARCHAR(191) NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `ip_address` VARCHAR(191) NULL,
    `upload_speed_kbps` DOUBLE NOT NULL DEFAULT 0,
    `download_speed_kbps` DOUBLE NOT NULL DEFAULT 0,
    `download_bytes` DOUBLE NOT NULL DEFAULT 0,
    `upload_bytes` DOUBLE NOT NULL DEFAULT 0,
    `uptime` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'offline',
    `last_synced` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PPPoESession_router_id_idx`(`router_id`),
    INDEX `PPPoESession_pppoe_username_idx`(`pppoe_username`),
    INDEX `PPPoESession_customer_id_idx`(`customer_id`),
    INDEX `PPPoESession_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PPPoEProfile` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate_limit` VARCHAR(191) NULL,
    `ip_pool` VARCHAR(191) NULL,
    `shared_users` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommandQueue` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `command_type` VARCHAR(191) NOT NULL,
    `router_id` VARCHAR(191) NULL,
    `pppoe_username` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `result` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommandQueue_router_id_status_idx`(`router_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BandwidthLog` (
    `id` VARCHAR(191) NOT NULL,
    `log_date` VARCHAR(191) NOT NULL,
    `router_id` VARCHAR(191) NULL,
    `router_name` VARCHAR(191) NULL,
    `total_download_kbps` DOUBLE NOT NULL,
    `total_upload_kbps` DOUBLE NOT NULL,
    `active_sessions` INTEGER NOT NULL DEFAULT 0,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BandwidthLog_log_date_idx`(`log_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerBandwidthLog` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `log_date` VARCHAR(191) NOT NULL,
    `avg_download_kbps` DOUBLE NOT NULL DEFAULT 0,
    `avg_upload_kbps` DOUBLE NOT NULL DEFAULT 0,
    `download_gb` DOUBLE NOT NULL DEFAULT 0,
    `upload_gb` DOUBLE NOT NULL DEFAULT 0,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerBandwidthLog_customer_id_log_date_idx`(`customer_id`, `log_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VlanTraffic` (
    `id` VARCHAR(191) NOT NULL,
    `router_id` VARCHAR(191) NOT NULL,
    `router_name` VARCHAR(191) NULL,
    `vlan_id` VARCHAR(191) NOT NULL,
    `vlan_name` VARCHAR(191) NULL,
    `tx_kbps` DOUBLE NOT NULL DEFAULT 0,
    `rx_kbps` DOUBLE NOT NULL DEFAULT 0,
    `tx_bytes` DOUBLE NOT NULL DEFAULT 0,
    `rx_bytes` DOUBLE NOT NULL DEFAULT 0,
    `monitored` BOOLEAN NOT NULL DEFAULT false,
    `favorite` BOOLEAN NOT NULL DEFAULT false,
    `last_synced` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VlanTraffic_router_id_idx`(`router_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OLTDevice` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NOT NULL,
    `snmp_community` VARCHAR(191) NOT NULL DEFAULT 'public',
    `location` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'online',
    `total_pon_ports` INTEGER NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ONU` (
    `id` VARCHAR(191) NOT NULL,
    `olt_id` VARCHAR(191) NOT NULL,
    `olt_name` VARCHAR(191) NULL,
    `pon_port` VARCHAR(191) NULL,
    `serial_number` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `customer_name` VARCHAR(191) NULL,
    `rx_power_dbm` DOUBLE NULL,
    `tx_power_dbm` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'offline',
    `last_synced` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ONU_olt_id_idx`(`olt_id`),
    INDEX `ONU_customer_id_idx`(`customer_id`),
    INDEX `ONU_serial_number_idx`(`serial_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NetworkDevice` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'switch',
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `ports_total` INTEGER NOT NULL DEFAULT 0,
    `ports_used` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CableRoute` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cable_type` VARCHAR(191) NOT NULL DEFAULT 'fiber',
    `color` VARCHAR(191) NULL,
    `is_live` BOOLEAN NOT NULL DEFAULT false,
    `path` LONGTEXT NULL,
    `start_lat` DOUBLE NULL,
    `start_lng` DOUBLE NULL,
    `end_lat` DOUBLE NULL,
    `end_lng` DOUBLE NULL,
    `length_meters` DOUBLE NULL,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Office` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'sub_office',
    `address` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `phone` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Zone` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'support',
    `department` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `address` TEXT NULL,
    `salary` DOUBLE NULL,
    `join_date` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkReport` (
    `id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NULL,
    `staff_name` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `report_date` VARCHAR(191) NOT NULL,
    `hours` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `category` VARCHAR(191) NOT NULL DEFAULT 'other',
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkReport_staff_id_idx`(`staff_id`),
    INDEX `WorkReport_staff_name_idx`(`staff_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reseller` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `balance` DOUBLE NOT NULL DEFAULT 0,
    `commission_rate` DOUBLE NOT NULL DEFAULT 0,
    `total_customers` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `join_date` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `customer_name` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `category` VARCHAR(191) NOT NULL DEFAULT 'connectivity',
    `assigned_to` VARCHAR(191) NULL,
    `resolution` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT 'indigo',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignupRequest` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `package_id` VARCHAR(191) NULL,
    `package_name` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `request_date` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountingTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'income',
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `amount` DOUBLE NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `payment_method` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `reference` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccountingTransaction_type_idx`(`type`),
    INDEX `AccountingTransaction_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HotspotUser` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `profile` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `mac_address` VARCHAR(191) NULL,
    `uptime` VARCHAR(191) NULL,
    `bytes_in` DOUBLE NOT NULL DEFAULT 0,
    `bytes_out` DOUBLE NOT NULL DEFAULT 0,
    `limit_uptime` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `comment` TEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HotspotProfile` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shared_users` INTEGER NOT NULL DEFAULT 1,
    `rate_limit` VARCHAR(191) NULL,
    `session_timeout` VARCHAR(191) NULL,
    `validity` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HotspotVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unused',
    `customer_name` VARCHAR(191) NULL,
    `validity` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `used_at` VARCHAR(191) NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentIntent` (
    `id` VARCHAR(191) NOT NULL,
    `gateway` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NULL,
    `package_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `gateway_ref` VARCHAR(191) NULL,
    `raw_response` LONGTEXT NULL,
    `created_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_date` DATETIME(3) NOT NULL,

    INDEX `PaymentIntent_gateway_gateway_ref_idx`(`gateway`, `gateway_ref`),
    INDEX `PaymentIntent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
