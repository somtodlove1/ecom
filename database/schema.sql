-- ============================================
-- E-Commerce Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS ecommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecommerce_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  full_name VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  image_url VARCHAR(500),
  category_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_cart_item (user_id, product_id)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'slip_uploaded', 'confirmed', 'shipping', 'completed', 'cancelled') DEFAULT 'pending',
  slip_image_url VARCHAR(500),
  shipping_address TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- Seed Data
-- ============================================

-- Default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role, full_name) VALUES
('admin', 'admin@shop.com', '$2a$10$rQnhyKTrexzqBkQ5RxJxUuzL0C/bxK.u3blrS1PH6OopJRHQcHyDG', 'admin', 'ผู้ดูแลระบบ');

-- Categories
INSERT INTO categories (name, slug) VALUES
('อิเล็กทรอนิกส์', 'electronics'),
('เสื้อผ้า', 'clothing'),
('อาหารและเครื่องดื่ม', 'food'),
('ความงาม', 'beauty'),
('กีฬา', 'sports'),
('ของใช้ในบ้าน', 'home');

-- Sample Products
INSERT INTO products (name, description, price, stock, image_url, category_id) VALUES
('หูฟัง Bluetooth Pro', 'หูฟังไร้สายคุณภาพสูง เสียงคมชัด ตัดเสียงรบกวน', 1290.00, 50, '/uploads/products/product1.jpg', 1),
('สมาร์ทวอทช์ Gen5', 'นาฬิกาอัจฉริยะ ติดตามสุขภาพ กันน้ำ 50m', 3590.00, 30, '/uploads/products/product2.jpg', 1),
('เสื้อยืด Premium Cotton', 'เสื้อผ้า 100% Cotton นุ่มสบาย มีหลายสี', 350.00, 200, '/uploads/products/product3.jpg', 2),
('กางเกง Jogger', 'กางเกงออกกำลังกาย สวมใส่สบาย เหมาะทุกโอกาส', 590.00, 150, '/uploads/products/product4.jpg', 2),
('ครีมบำรุงผิว Hyaluron', 'ครีมบำรุงผิวหน้า ลดริ้วรอย ให้ความชุ่มชื้น', 890.00, 80, '/uploads/products/product5.jpg', 4),
('ลิปสติก Matte', 'ลิปสติกเนื้อแมทท์ ติดทน กันน้ำ 12 สี', 420.00, 120, '/uploads/products/product6.jpg', 4),
('ดัมเบล 5kg (คู่)', 'ดัมเบลเคลือบยาง ไม่เป็นสนิม น้ำหนัก 5kg/ข้าง', 750.00, 40, '/uploads/products/product7.jpg', 5),
('โยคะแมท พรีเมียม', 'เสื่อโยคะหนา 6mm กันลื่น ทำความสะอาดง่าย', 490.00, 60, '/uploads/products/product8.jpg', 5),
('หม้อทอดไร้น้ำมัน 5L', 'หม้อทอดอากาศ ประหยัดพลังงาน ความจุ 5 ลิตร', 2290.00, 25, '/uploads/products/product9.jpg', 6),
('ชุดเครื่องนอน Cotton', 'ชุดผ้าปูที่นอน Cotton 100% ขนาด 6 ฟุต', 1190.00, 35, '/uploads/products/product10.jpg', 6),
('กาแฟ Arabica คั่วกลาง 250g', 'เมล็ดกาแฟอาราบิก้า คั่วกลาง หอม เข้มข้น', 280.00, 100, '/uploads/products/product11.jpg', 3),
('น้ำผึ้งแท้ 100% 500ml', 'น้ำผึ้งธรรมชาติ จากดอกลำไย บริสุทธิ์ 100%', 320.00, 75, '/uploads/products/product12.jpg', 3);
