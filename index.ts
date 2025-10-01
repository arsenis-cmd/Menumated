// File: backend/src/index.ts
// How to name: backend/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import robotController from './services/robotController';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('Connected to MongoDB');
    robotController.initialize();
  })
  .catch(err => console.error('MongoDB error:', err));

// Routes
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import tableRoutes from './routes/tables';
import courierRoutes from './routes/couriers';
import adminRoutes from './routes/admin';

app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/admin', adminRoutes);

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:kitchen', () => {
    socket.join('kitchen');
  });

  socket.on('join:courier', (courierId) => {
    socket.join(`courier:${courierId}`);
  });

  socket.on('join:table', (tableNumber) => {
    socket.join(`table:${tableNumber}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Smart Restaurant API running on port ${PORT}`);
});

export { io };

// File: backend/src/routes/orders.ts
// How to name: backend/src/routes/orders.ts

import { Router } from 'express';
import { Order, MenuItem, KitchenQueue, Courier } from '../models/schemas';
import { io } from '../index';
import robotController from '../services/robotController';

const router = Router();

// Create new order (from customer tablet)
router.post('/', async (req, res) => {
  try {
    const { table_number, items, order_type, customer, special_instructions } = req.body;

    // Calculate pricing
    let subtotal = 0;
    const orderItems = await Promise.all(
      items.map(async (item: any) => {
        const menuItem = await MenuItem.findOne({ item_id: item.item_id });
        if (!menuItem) throw new Error(`Item ${item.item_id} not found`);
        
        const itemTotal = menuItem.price * item.quantity;
        subtotal += itemTotal;

        return {
          item_id: item.item_id,
          name: menuItem.name,
          quantity: item.quantity,
          price: menuItem.price,
          special_instructions: item.special_instructions || ''
        };
      })
    );

    const tax = subtotal * 0.08; // 8% tax
    const delivery_fee = order_type === 'delivery' ? 5.99 : 0;
    const total = subtotal + tax + delivery_fee;

    // Create order
    const order = new Order({
      order_id: `ORD-${Date.now()}`,
      order_type,
      table_number: order_type === 'dine_in' ? table_number : undefined,
      customer: order_type === 'delivery' ? customer : undefined,
      items: orderItems,
      subtotal,
      tax,
      delivery_fee,
      total,
      status: 'placed',
      timeline: [{
        status: 'placed',
        timestamp: new Date()
      }],
      estimated_prep_time: orderItems.reduce((sum: number, item: any) => {
        return Math.max(sum, item.prep_time || 15);
      }, 0)
    });

    await order.save();

    // Add to kitchen queue
    const queueItem = new KitchenQueue({
      order_id: order.order_id,
      items: orderItems,
      priority: order_type === 'delivery' ? 1 : 2,
      estimated_time: order.estimated_prep_time,
      table_number: table_number,
      order_type: order_type
    });

    await queueItem.save();

    // Emit to kitchen display
    io.to('kitchen').emit('order:new', order);

    // Emit to customer tablet
    if (table_number) {
      io.to(`table:${table_number}`).emit('order:confirmed', {
        order_id: order.order_id,
        estimated_time: order.estimated_prep_time
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status (from kitchen)
router.patch('/:order_id/status', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date()
    });

    await order.save();

    // Handle different status transitions
    if (status === 'ready' && order.order_type === 'dine_in') {
      // Assign robot for delivery
      await robotController.assignRobotToOrder(order_id);
      
      io.to('kitchen').emit('order:ready', { order_id });
      io.to(`table:${order.table_number}`).emit('order:ready', {
        order_id,
        message: 'Your food is ready! Robot is on the way.'
      });
    }

    if (status === 'ready' && order.order_type === 'delivery') {
      // Assign courier
      await assignCourierToOrder(order_id);
      
      io.to('kitchen').emit('order:ready', { order_id });
    }

    res.json(order);
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get order status (for customer tracking)
router.get('/:order_id/status', async (req, res) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      order_id: order.order_id,
      status: order.status,
      timeline: order.timeline,
      estimated_delivery: order.estimated_delivery_time
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Get kitchen queue
router.get('/kitchen/queue', async (req, res) => {
  try {
    const queue = await KitchenQueue.find({ completed_at: null })
      .sort({ priority: 1, added_at: 1 });

    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Helper function to assign courier
async function assignCourierToOrder(orderId: string) {
  try {
    const order = await Order.findOne({ order_id: orderId });
    if (!order) return false;

    // Find available courier nearest to restaurant
    const courier = await Courier.findOne({
      status: 'available',
      is_active: true
    }).sort({ 'stats.rating.average': -1 });

    if (!courier) {
      console.log('No available couriers');
      return false;
    }

    // Assign courier
    courier.status = 'assigned';
    courier.current_order_id = orderId;
    await courier.save();

    order.assigned_to.courier_id = courier.courier_id;
    order.status = 'out_for_delivery';
    await order.save();

    // Notify courier
    io.to(`courier:${courier.courier_id}`).emit('order:assigned', {
      order_id: orderId,
      pickup_address: 'Restaurant Address',
      delivery_address: order.customer?.address,
      payout: calculateCourierPayout(order)
    });

    return true;
  } catch (error) {
    console.error('Courier assignment error:', error);
    return false;
  }
}

function calculateCourierPayout(order: any): number {
  const basePay = 3.00;
  const perMile = 1.50;
  const tip = order.tip || 0;
  
  // Simplified distance calculation
  const estimatedMiles = 3;
  
  return basePay + (perMile * estimatedMiles) + tip;
}

export default router;

// File: backend/src/routes/menu.ts
// How to name: backend/src/routes/menu.ts

import { Router } from 'express';
import { MenuItem } from '../models/schemas';

const router = Router();

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    const filter: any = { is_available: true };
    if (category && category !== 'all') {
      filter.category = category;
    }

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Get single item
router.get('/:item_id', async (req, res) => {
  try {
    const item = await MenuItem.findOne({ item_id: req.params.item_id });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create menu item (admin)
router.post('/', async (req, res) => {
  try {
    const item = new MenuItem(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update menu item availability (admin)
router.patch('/:item_id/availability', async (req, res) => {
  try {
    const { is_available } = req.body;
    
    const item = await MenuItem.findOneAndUpdate(
      { item_id: req.params.item_id },
      { is_available },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

export default router;

// File: backend/src/routes/couriers.ts
// How to name: backend/src/routes/couriers.ts

import { Router } from 'express';
import { Courier, Order } from '../models/schemas';
import { io } from '../index';

const router = Router();

// Courier login/status update
router.post('/:courier_id/status', async (req, res) => {
  try {
    const { courier_id } = req.params;
    const { status, location } = req.body;

    const courier = await Courier.findOneAndUpdate(
      { courier_id },
      {
        status,
        'current_location': location,
        'current_location.updated_at': new Date()
      },
      { new: true }
    );

    if (!courier) {
      return res.status(404).json({ error: 'Courier not found' });
    }

    res.json(courier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get courier's current order
router.get('/:courier_id/current-order', async (req, res) => {
  try {
    const courier = await Courier.findOne({ courier_id: req.params.courier_id });
    
    if (!courier || !courier.current_order_id) {
      return res.json({ order: null });
    }

    const order = await Order.findOne({ order_id: courier.current_order_id });
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Complete delivery
router.post('/:courier_id/complete-delivery', async (req, res) => {
  try {
    const { courier_id } = req.params;
    const { order_id } = req.body;

    const courier = await Courier.findOne({ courier_id });
    const order = await Order.findOne({ order_id });

    if (!courier || !order) {
      return res.status(404).json({ error: 'Courier or order not found' });
    }

    // Update order
    order.status = 'delivered';
    order.completed_at = new Date();
    await order.save();

    // Update courier
    const payout = calculateCourierPayout(order);
    courier.status = 'available';
    courier.current_order_id = undefined;
    courier.stats.total_deliveries += 1;
    courier.stats.completed_today += 1;
    courier.stats.earnings_today += payout;
    courier.stats.earnings_total += payout;
    await courier.save();

    // Notify customer
    io.emit('order:delivered', { order_id });

    res.json({
      message: 'Delivery completed',
      payout,
      total_earnings_today: courier.stats.earnings_today
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete delivery' });
  }
});

function calculateCourierPayout(order: any): number {
  return 3.00 + 4.50 + (order.tip || 0); // Base + distance + tip
}

export default router;

// File: backend/src/routes/admin.ts  
// How to name: backend/src/routes/admin.ts

import { Router } from 'express';
import { Order, MenuItem, Robot, Courier, Analytics } from '../models/schemas';

const router = Router();

// Get dashboard analytics
router.get('/analytics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      created_at: { $gte: today }
    });

    const analytics = {
      today: {
        total_orders: orders.length,
        revenue: orders.reduce((sum, o) => sum + o.total, 0),
        avg_order_value: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0,
        dine_in: orders.filter(o => o.order_type === 'dine_in').length,
        delivery: orders.filter(o => o.order_type === 'delivery').length
      },
      robots: await Robot.countDocuments({ is_active: true }),
      active_couriers: await Courier.countDocuments({ status: { $ne: 'offline' } })
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get popular items
router.get('/popular-items', async (req, res) => {
  try {
    const items = await MenuItem.find()
      .sort({ times_ordered: -1 })
      .limit(10);

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular items' });
  }
});

export default router;
