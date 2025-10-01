// File: backend/models/schemas.js
// How to name: backend/models/schemas.js

const mongoose = require('mongoose');

// Menu Items Collection
const menuItemSchema = new mongoose.Schema({
  item_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['appetizer', 'main', 'dessert', 'beverage', 'special'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  image_url: String,
  
  // Dietary information
  dietary_tags: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'halal', 'kosher', 'spicy']
  }],
  
  // Preparation
  prep_time: Number, // minutes
  ingredients: [String],
  allergens: [String],
  
  // Availability
  is_available: {
    type: Boolean,
    default: true
  },
  available_times: {
    breakfast: Boolean,
    lunch: Boolean,
    dinner: Boolean
  },
  
  // Popularity
  times_ordered: {
    type: Number,
    default: 0
  },
  rating: {
    average: Number,
    count: Number
  },
  
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Tables Collection
const tableSchema = new mongoose.Schema({
  table_number: {
    type: Number,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: true
  },
  
  // Location in restaurant (for robot navigation)
  location: {
    x: Number, // Grid coordinates
    y: Number,
    zone: String // 'indoor', 'patio', 'bar'
  },
  
  // Status
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'cleaning', 'out_of_service'],
    default: 'available'
  },
  
  // Current session
  current_session: {
    session_id: String,
    started_at: Date,
    customer_count: Number,
    tablet_id: String
  },
  
  qr_code: String, // For customer menu access
  
  created_at: Date
});

// Orders Collection
const orderSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true
  },
  
  // Type
  order_type: {
    type: String,
    enum: ['dine_in', 'delivery', 'takeout'],
    required: true
  },
  
  // Table information (for dine-in)
  table_number: Number,
  
  // Customer information (for delivery)
  customer: {
    name: String,
    phone: String,
    address: {
      street: String,
      city: String,
      zip: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    delivery_instructions: String
  },
  
  // Items
  items: [{
    item_id: String,
    name: String,
    quantity: Number,
    price: Number,
    special_instructions: String,
    modifications: [String]
  }],
  
  // Pricing
  subtotal: Number,
  tax: Number,
  tip: Number,
  delivery_fee: Number,
  total: Number,
  
  // Status tracking
  status: {
    type: String,
    enum: [
      'placed',           // Customer placed order
      'confirmed',        // Restaurant confirmed
      'preparing',        // Chef cooking
      'ready',           // Food ready
      'out_for_delivery', // With courier
      'delivering',       // Robot delivering (dine-in)
      'delivered',        // Completed
      'cancelled'
    ],
    default: 'placed'
  },
  
  // Timeline
  timeline: [{
    status: String,
    timestamp: Date,
    note: String
  }],
  
  // Assignment
  assigned_to: {
    chef_id: String,
    robot_id: String,
    courier_id: String
  },
  
  // Estimated times
  estimated_prep_time: Number, // minutes
  estimated_delivery_time: Date,
  
  // Payment
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  payment_method: String,
  payment_transaction_id: String,
  
  // Special flags
  priority: {
    type: Boolean,
    default: false
  },
  is_urgent: Boolean,
  
  created_at: {
    type: Date,
    default: Date.now
  },
  completed_at: Date
});

// Robots Collection
const robotSchema = new mongoose.Schema({
  robot_id: {
    type: String,
    required: true,
    unique: true
  },
  name: String, // "Robot 1", "Bot-A"
  
  // Current state
  status: {
    type: String,
    enum: ['idle', 'navigating', 'picking_up', 'delivering', 'returning', 'charging', 'maintenance'],
    default: 'idle'
  },
  
  // Position
  current_position: {
    x: Number,
    y: Number,
    facing: String // 'north', 'east', 'south', 'west'
  },
  
  // Current task
  current_order_id: String,
  current_task: {
    type: String,
    from: { x: Number, y: Number },
    to: { x: Number, y: Number },
    started_at: Date
  },
  
  // Path (A* algorithm result)
  current_path: [{
    x: Number,
    y: Number
  }],
  
  // Capacity
  max_capacity: Number, // kg
  current_load: Number,
  
  // Battery
  battery_level: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  
  // Statistics
  stats: {
    total_deliveries: Number,
    total_distance: Number, // meters
    uptime_hours: Number,
    errors: Number
  },
  
  // Maintenance
  last_maintenance: Date,
  needs_maintenance: Boolean,
  
  is_active: {
    type: Boolean,
    default: true
  },
  
  created_at: Date
});

// Couriers Collection
const courierSchema = new mongoose.Schema({
  courier_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phone: String,
  email: String,
  
  // Status
  status: {
    type: String,
    enum: ['offline', 'available', 'assigned', 'picking_up', 'delivering'],
    default: 'offline'
  },
  
  // Location
  current_location: {
    latitude: Number,
    longitude: Number,
    updated_at: Date
  },
  
  // Current delivery
  current_order_id: String,
  
  // Vehicle
  vehicle_type: {
    type: String,
    enum: ['bike', 'scooter', 'car', 'motorcycle']
  },
  vehicle_number: String,
  
  // Performance
  stats: {
    total_deliveries: Number,
    completed_today: Number,
    rating: {
      average: Number,
      count: Number
    },
    on_time_percentage: Number,
    earnings_today: Number,
    earnings_total: Number
  },
  
  // Availability
  working_hours: {
    start: String, // "09:00"
    end: String    // "21:00"
  },
  is_active: Boolean,
  
  // Banking (for payouts)
  bank_details: {
    account_number: String,
    routing_number: String,
    account_holder: String
  },
  
  created_at: Date
});

// Restaurant Layout (for robot navigation)
const restaurantLayoutSchema = new mongoose.Schema({
  layout_id: {
    type: String,
    default: 'main_floor'
  },
  
  dimensions: {
    width: Number,  // Grid units
    height: Number
  },
  
  // Grid-based layout
  grid: [[Number]], // 2D array: 0=empty, 1=obstacle, 2=kitchen, 3=table
  
  // Special locations
  locations: {
    kitchen: { x: Number, y: Number },
    charging_stations: [{ x: Number, y: Number }],
    entrance: { x: Number, y: Number },
    bar: { x: Number, y: Number }
  },
  
  // Obstacles
  obstacles: [{
    type: String, // 'wall', 'furniture', 'column'
    x: Number,
    y: Number,
    width: Number,
    height: Number
  }],
  
  updated_at: Date
});

// Kitchen Queue (for chef interface)
const kitchenQueueSchema = new mongoose.Schema({
  order_id: String,
  items: [{
    item_id: String,
    name: String,
    quantity: Number,
    special_instructions: String
  }],
  priority: Number, // 1=highest
  estimated_time: Number,
  table_number: Number,
  order_type: String,
  added_at: {
    type: Date,
    default: Date.now
  },
  started_at: Date,
  completed_at: Date
});

// Delivery Zones (for courier assignment)
const deliveryZoneSchema = new mongoose.Schema({
  zone_name: String,
  zip_codes: [String],
  boundaries: {
    type: {
      type: String,
      default: 'Polygon'
    },
    coordinates: [[[Number]]] // GeoJSON polygon
  },
  base_delivery_fee: Number,
  estimated_time: Number, // minutes
  is_active: Boolean
});

// Analytics/Reporting
const analyticsSchema = new mongoose.Schema({
  date: Date,
  
  orders: {
    total: Number,
    dine_in: Number,
    delivery: Number,
    takeout: Number,
    cancelled: Number
  },
  
  revenue: {
    total: Number,
    food: Number,
    delivery_fees: Number,
    tips: Number
  },
  
  performance: {
    avg_prep_time: Number,
    avg_delivery_time: Number,
    robot_efficiency: Number,
    courier_efficiency: Number
  },
  
  popular_items: [{
    item_id: String,
    name: String,
    quantity_sold: Number
  }],
  
  peak_hours: [{
    hour: Number,
    order_count: Number
  }]
});

// Indexes for performance
orderSchema.index({ order_id: 1 });
orderSchema.index({ status: 1, created_at: -1 });
orderSchema.index({ table_number: 1, status: 1 });
orderSchema.index({ 'assigned_to.courier_id': 1 });
robotSchema.index({ status: 1 });
courierSchema.index({ status: 1, 'current_location': '2dsphere' });
menuItemSchema.index({ category: 1, is_available: 1 });

module.exports = {
  MenuItem: mongoose.model('MenuItem', menuItemSchema),
  Table: mongoose.model('Table', tableSchema),
  Order: mongoose.model('Order', orderSchema),
  Robot: mongoose.model('Robot', robotSchema),
  Courier: mongoose.model('Courier', courierSchema),
  RestaurantLayout: mongoose.model('RestaurantLayout', restaurantLayoutSchema),
  KitchenQueue: mongoose.model('KitchenQueue', kitchenQueueSchema),
  DeliveryZone: mongoose.model('DeliveryZone', deliveryZoneSchema),
  Analytics: mongoose.model('Analytics', analyticsSchema)
};
