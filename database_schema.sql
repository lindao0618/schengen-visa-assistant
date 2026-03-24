-- 申根签证助手数据库设计
-- 去掉社区和问答系统模块的精简版本

-- ========================================
-- 1. 用户管理模块
-- ========================================

-- 用户表
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    email_verified TIMESTAMP NULL,
    image VARCHAR(500),
    phone VARCHAR(20),
    country VARCHAR(50),
    language VARCHAR(10) DEFAULT 'zh-CN',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 用户账户关联表（OAuth）
CREATE TABLE accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(20),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_provider_account (provider, provider_account_id),
    INDEX idx_user_id (user_id)
);

-- 用户会话表
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    expires TIMESTAMP NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_token (session_token),
    INDEX idx_user_id (user_id)
);

-- 验证令牌表
CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires TIMESTAMP NOT NULL,
    
    UNIQUE KEY unique_identifier_token (identifier, token)
);

-- ========================================
-- 2. 签证申请管理模块
-- ========================================

-- 签证申请主表
CREATE TABLE applications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    visa_type ENUM('schengen', 'usa', 'japan', 'uk', 'canada', 'australia') NOT NULL,
    country VARCHAR(50) NOT NULL,
    status ENUM('draft', 'submitted', 'processing', 'approved', 'rejected', 'cancelled') DEFAULT 'draft',
    priority ENUM('normal', 'urgent', 'super_urgent') DEFAULT 'normal',
    
    -- 申请详情（JSON格式存储不同签证类型的特定数据）
    application_data JSON NOT NULL,
    
    -- 时间信息
    intended_entry_date DATE,
    intended_exit_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    processed_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_visa_type_country (visa_type, country),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 申根签证申请表（扩展表）
CREATE TABLE schengen_applications (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    
    -- 个人信息
    personal_info JSON NOT NULL,
    
    -- 旅行信息
    travel_info JSON NOT NULL,
    
    -- 住宿信息
    accommodation_info JSON NOT NULL,
    
    -- 财务信息
    financial_info JSON NOT NULL,
    
    -- 保险信息
    insurance_info JSON NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    INDEX idx_application_id (application_id)
);

-- 美国签证申请表（扩展表）
CREATE TABLE usa_applications (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    
    -- DS-160表格数据
    ds160_data JSON NOT NULL,
    
    -- 面试信息
    interview_info JSON,
    
    -- 预约信息
    appointment_info JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    INDEX idx_application_id (application_id)
);

-- ========================================
-- 3. 文档管理模块
-- ========================================

-- 文档表
CREATE TABLE documents (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    application_id VARCHAR(36) NOT NULL,
    
    -- 文档信息
    type ENUM('passport', 'photo', 'flight', 'hotel', 'insurance', 'financial', 'employment', 'other') NOT NULL,
    category VARCHAR(50),  -- 子分类
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    -- 文档状态
    status ENUM('uploaded', 'processing', 'approved', 'rejected', 'expired') DEFAULT 'uploaded',
    
    -- AI分析结果
    ai_analysis JSON,
    ai_confidence DECIMAL(3,2),
    
    -- 审核信息
    review_notes TEXT,
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_application_id (application_id),
    INDEX idx_type_status (type, status),
    INDEX idx_created_at (created_at)
);

-- 文档审核记录表
CREATE TABLE document_reviews (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    reviewer_id VARCHAR(36) NOT NULL,
    
    -- 审核结果
    result ENUM('approved', 'rejected', 'needs_revision') NOT NULL,
    feedback TEXT,
    score DECIMAL(3,2),  -- 0-1评分
    
    -- 审核详情
    review_details JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_document_id (document_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- 4. AI助手和聊天模块
-- ========================================

-- 聊天会话表
CREATE TABLE chat_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    application_id VARCHAR(36),
    
    -- 会话信息
    title VARCHAR(255),
    session_type ENUM('general', 'application_help', 'document_review', 'visa_guidance') DEFAULT 'general',
    
    -- 会话状态
    status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_application_id (application_id),
    INDEX idx_status (status)
);

-- 聊天消息表
CREATE TABLE chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    
    -- 消息内容
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    content_type ENUM('text', 'image', 'file', 'json') DEFAULT 'text',
    
    -- AI相关
    model VARCHAR(50),  -- 使用的AI模型
    tokens_used INT,
    processing_time_ms INT,
    
    -- 消息状态
    status ENUM('sending', 'sent', 'failed', 'delivered') DEFAULT 'sent',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at)
);

-- AI知识库表
CREATE TABLE ai_knowledge_base (
    id VARCHAR(36) PRIMARY KEY,
    
    -- 知识内容
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    tags JSON,
    
    -- 关联信息
    country VARCHAR(50),
    visa_type VARCHAR(50),
    
    -- 使用统计
    usage_count INT DEFAULT 0,
    helpful_count INT DEFAULT 0,
    not_helpful_count INT DEFAULT 0,
    
    -- 状态
    status ENUM('active', 'inactive', 'pending_review') DEFAULT 'active',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_country_visa (country, visa_type),
    INDEX idx_status (status),
    FULLTEXT idx_search (question, answer)
);

-- ========================================
-- 5. 预约和监控模块
-- ========================================

-- 预约表
CREATE TABLE appointments (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- 预约信息
    visa_center VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_type ENUM('interview', 'document_submission', 'biometrics') NOT NULL,
    
    -- 预约状态
    status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
    
    -- 费用信息
    fee_amount DECIMAL(10,2),
    fee_currency VARCHAR(3) DEFAULT 'USD',
    payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
    
    -- 通知设置
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_status (status)
);

-- 槽位监控表
CREATE TABLE slot_monitors (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    -- 监控配置
    visa_type VARCHAR(50) NOT NULL,
    country VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    consulate_code VARCHAR(10) NOT NULL,
    
    -- 日期范围
    date_ranges JSON NOT NULL,  -- [{"start": "2025-08-26", "end": "2025-09-26"}]
    
    -- 监控状态
    status ENUM('active', 'paused', 'matched', 'expired') DEFAULT 'active',
    
    -- 通知设置
    email_notifications BOOLEAN DEFAULT TRUE,
    browser_notifications BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    matched_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_visa_type_country (visa_type, country),
    INDEX idx_created_at (created_at)
);

-- 槽位数据表
CREATE TABLE slot_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slot_hash VARCHAR(64) UNIQUE NOT NULL,
    
    -- 槽位信息
    country VARCHAR(10) NOT NULL,
    city VARCHAR(50) NOT NULL,
    visa_type VARCHAR(50) NOT NULL,
    available_dates JSON NOT NULL,
    from_source VARCHAR(50),
    
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    INDEX idx_slot_hash (slot_hash),
    INDEX idx_country_city_visa (country, city, visa_type),
    INDEX idx_received_at (received_at)
);

-- 匹配记录表
CREATE TABLE slot_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    monitor_id VARCHAR(36) NOT NULL,
    slot_id BIGINT NOT NULL,
    
    -- 匹配详情
    match_score DECIMAL(3,2) DEFAULT 1.00,
    matched_criteria JSON NOT NULL,
    
    -- 通知状态
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (monitor_id) REFERENCES slot_monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES slot_data(id) ON DELETE CASCADE,
    UNIQUE KEY unique_match (monitor_id, slot_id),
    INDEX idx_monitor_id (monitor_id),
    INDEX idx_created_at (created_at)
);

-- 邮件通知记录表
CREATE TABLE email_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    match_record_id BIGINT NOT NULL,
    
    -- 邮件信息
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email_content TEXT NOT NULL,
    
    -- 发送状态
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    error_message TEXT NULL,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键
    FOREIGN KEY (match_record_id) REFERENCES slot_matches(id),
    
    -- 索引
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- 6. 系统管理模块
-- ========================================

-- 系统配置表
CREATE TABLE system_configs (
    id VARCHAR(36) PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_config_key (config_key)
);

-- 系统日志表
CREATE TABLE system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 日志信息
    level ENUM('debug', 'info', 'warn', 'error', 'fatal') NOT NULL,
    message TEXT NOT NULL,
    context JSON,
    
    -- 用户和请求信息
    user_id VARCHAR(36),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_url VARCHAR(500),
    request_method VARCHAR(10),
    
    -- 错误信息
    error_stack TEXT,
    error_code VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_level (level),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- 用户活动日志表
CREATE TABLE user_activities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    -- 活动信息
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSON,
    
    -- 上下文信息
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(36),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- 7. 性能优化索引
-- ========================================

-- 复合索引优化常用查询
CREATE INDEX idx_applications_user_status ON applications(user_id, status);
CREATE INDEX idx_documents_app_type_status ON documents(application_id, type, status);
CREATE INDEX idx_chat_sessions_user_status ON chat_sessions(user_id, status);
CREATE INDEX idx_slot_monitors_user_status ON slot_monitors(user_id, status);

-- 时间范围查询优化
CREATE INDEX idx_applications_created_status ON applications(created_at, status);
CREATE INDEX idx_documents_created_type ON documents(created_at, type);
CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- ========================================
-- 8. 初始数据
-- ========================================

-- 插入系统配置
INSERT INTO system_configs (id, config_key, config_value, config_type, description) VALUES
('sys-001', 'site_name', '申根签证助手', 'string', '网站名称'),
('sys-002', 'site_description', '专业的签证申请助手平台', 'string', '网站描述'),
('sys-003', 'max_file_size', '10485760', 'number', '最大文件上传大小（字节）'),
('sys-004', 'allowed_file_types', '["jpg","jpeg","png","pdf","doc","docx"]', 'json', '允许上传的文件类型'),
('sys-005', 'email_notifications_enabled', 'true', 'boolean', '是否启用邮件通知'),
('sys-006', 'ai_model_default', 'gpt-3.5-turbo', 'string', '默认AI模型'),
('sys-007', 'slot_monitor_interval', '300', 'number', '槽位监控间隔（秒）'),
('sys-008', 'session_timeout', '3600', 'number', '会话超时时间（秒）');

-- 插入AI知识库示例数据
INSERT INTO ai_knowledge_base (id, question, answer, category, tags, country, visa_type, status) VALUES
('kb-001', '申根签证需要准备哪些材料？', '申根签证需要准备以下材料：1. 护照原件及复印件 2. 签证申请表 3. 照片 4. 旅行保险 5. 机票预订 6. 酒店预订 7. 财力证明 8. 在职证明等。', '材料准备', '["申根签证","材料","准备"]', '通用', 'schengen', 'active'),
('kb-002', '美国签证DS-160表格如何填写？', 'DS-160表格是美国签证申请的重要文件，需要在线填写。主要包括个人信息、旅行信息、工作信息、教育背景等。填写时要注意信息准确性和一致性。', '表格填写', '["美国签证","DS-160","表格"]', '美国', 'usa', 'active'),
('kb-003', '签证照片有什么要求？', '签证照片要求：1. 尺寸通常为35x45mm 2. 白色背景 3. 正面免冠 4. 表情自然 5. 眼睛睁开 6. 不戴眼镜或帽子 7. 照片清晰无污损。', '照片要求', '["照片","要求","标准"]', '通用', '通用', 'active');

-- ========================================
-- 9. 数据库权限设置
-- ========================================

-- 创建应用用户
-- CREATE USER 'visa_assistant'@'%' IDENTIFIED BY 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON visa_assistant.* TO 'visa_assistant'@'%';
-- FLUSH PRIVILEGES;

-- ========================================
-- 10. 数据库维护脚本
-- ========================================

-- 清理过期数据的存储过程
DELIMITER //
CREATE PROCEDURE CleanupExpiredData()
BEGIN
    -- 清理超过30天的系统日志
    DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 清理超过90天的用户活动日志
    DELETE FROM user_activities WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- 清理过期的验证令牌
    DELETE FROM verification_tokens WHERE expires < NOW();
    
    -- 清理过期的会话
    DELETE FROM sessions WHERE expires < NOW();
    
    -- 清理过期的槽位数据（保留7天）
    DELETE FROM slot_data WHERE received_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
END //
DELIMITER ;

-- 创建定时任务（需要MySQL Event Scheduler）
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT cleanup_expired_data_event
-- ON SCHEDULE EVERY 1 DAY
-- DO CALL CleanupExpiredData();










