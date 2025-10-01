// File: frontend/kitchen-display/src/components/KitchenDisplay.tsx
// How to name: frontend/kitchen-display/src/components/KitchenDisplay.tsx

import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, AlertCircle, Check, Flame, Users } from 'lucide-react';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([
    {
      order_id: 'ORD-001',
      table_number: 12,
      order_type: 'dine_in',
      status: 'preparing',
      items: [
        { name: 'Grilled Salmon', quantity: 2, special_instructions: 'No butter' },
        { name: 'Caesar Salad', quantity: 1, special_instructions: '' }
      ],
      created_at: new Date(Date.now() - 5 * 60000),
      estimated_time: 15,
      priority: 2
    },
    {
      order_id: 'ORD-002',
      table_number: 8,
      order_type: 'dine_in',
      status: 'new',
      items: [
        { name: 'Beef Burger', quantity: 3, special_instructions: 'Medium rare' },
        { name: 'Fresh Lemonade', quantity: 3, special_instructions: '' }
      ],
      created_at: new Date(Date.now() - 2 * 60000),
      estimated_time: 12,
      priority: 1
    },
    {
      order_id: 'ORD-003',
      table_number: null,
      order_type: 'delivery',
      status: 'new',
      items: [
        { name: 'Margherita Pizza', quantity: 2, special_instructions: 'Extra cheese' },
        { name: 'Chocolate Lava Cake', quantity: 1, special_instructions: '' }
      ],
      created_at: new Date(Date.now() - 1 * 60000),
      estimated_time: 18,
      priority: 1,
      delivery_address: '123 Main St'
    }
  ]);

  const [stats, setStats] = useState({
    active_orders: 3,
    completed_today: 47,
    avg_prep_time: 14,
    pending_queue: 3
  });

  const getElapsedTime = (createdAt: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
    return diff;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'preparing': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'ready': return 'bg-green-100 border-green-500 text-green-700';
      default: return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getUrgencyColor = (elapsedTime: number, estimatedTime: number) => {
    const ratio = elapsedTime / estimatedTime;
    if (ratio > 0.9) return 'text-red-600';
    if (ratio > 0.7) return 'text-orange-600';
    return 'text-green-600';
  };

  const updateOrderStatus = (orderId: string, newStatus: string) => {
    setOrders(orders.map(order => 
      order.order_id === orderId 
        ? { ...order, status: newStatus }
        : order
    ));
  };

  const completeOrder = (orderId: string) => {
    setOrders(orders.filter(order => order.order_id !== orderId));
    setStats({ ...stats, completed_today: stats.completed_today + 1, active_orders: stats.active_orders - 1 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6 border-2 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <ChefHat className="w-10 h-10 text-orange-500" />
                Kitchen Display System
              </h1>
              <p className="text-gray-400">Real-time order management</p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-6">
              <div className="bg-gray-700 rounded-xl p-4 min-w-32">
                <div className="text-orange-500 text-sm font-medium mb-1">Active Orders</div>
                <div className="text-4xl font-bold text-white">{stats.active_orders}</div>
              </div>
              
              <div className="bg-gray-700 rounded-xl p-4 min-w-32">
                <div className="text-green-500 text-sm font-medium mb-1">Completed Today</div>
                <div className="text-4xl font-bold text-white">{stats.completed_today}</div>
              </div>
              
              <div className="bg-gray-700 rounded-xl p-4 min-w-32">
                <div className="text-blue-500 text-sm font-medium mb-1">Avg Prep Time</div>
                <div className="text-4xl font-bold text-white">{stats.avg_prep_time}m</div>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.map(order => {
            const elapsedTime = getElapsedTime(order.created_at);
            const isUrgent = elapsedTime > order.estimated_time * 0.7;
            
            return (
              <div
                key={order.order_id}
                className={`bg-gray-800 rounded-2xl shadow-2xl p-6 border-4 ${getStatusColor(order.status)} transition-all ${
                  isUrgent ? 'animate-pulse' : ''
                }`}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {order.order_type === 'dine_in' ? (
                        <>
                          <Users className="w-6 h-6 inline mr-2" />
                          Table {order.table_number}
                        </>
                      ) : (
                        <>
                          <Flame className="w-6 h-6 inline mr-2" />
                          Delivery
                        </>
                      )}
                    </h2>
                    <p className="text-gray-400 text-sm">{order.order_id}</p>
                    {order.delivery_address && (
                      <p className="text-gray-500 text-xs mt-1">{order.delivery_address}</p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getUrgencyColor(elapsedTime, order.estimated_time)}`}>
                      {elapsedTime}m
                    </div>
                    <div className="text-gray-400 text-xs">/ {order.estimated_time}m</div>
                  </div>
                </div>

                {/* Priority Badge */}
                {order.priority === 1 && (
                  <div className="mb-4 flex items-center gap-2 bg-red-900 border-2 border-red-500 text-red-200 px-3 py-2 rounded-lg text-sm font-bold">
                    <AlertCircle className="w-4 h-4" />
                    HIGH PRIORITY
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-3 mb-6">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-700 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                              {item.quantity}
                            </span>
                            <h3 className="text-xl font-bold text-white">{item.name}</h3>
                          </div>
                        </div>
                      </div>
                      
                      {item.special_instructions && (
                        <div className="mt-2 bg-yellow-900 border-2 border-yellow-500 rounded-lg p-2">
                          <p className="text-yellow-200 text-sm font-medium">
                            📝 {item.special_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {order.status === 'new' && (
                    <button
                      onClick={() => updateOrderStatus(order.order_id, 'preparing')}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <ChefHat className="w-5 h-5" />
                      Start Cooking
                    </button>
                  )}
                  
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order.order_id, 'ready')}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Mark Ready
                    </button>
                  )}
                  
                  {order.status === 'ready' && (
                    <button
                      onClick={() => completeOrder(order.order_id)}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-700 hover:to-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      🤖 Robot Delivering
                    </button>
                  )}
                </div>

                {/* Timer Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        elapsedTime > order.estimated_time ? 'bg-red-500' :
                        elapsedTime > order.estimated_time * 0.7 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((elapsedTime / order.estimated_time) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {orders.length === 0 && (
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-12 text-center">
            <div className="text-8xl mb-4">👨‍🍳</div>
            <h2 className="text-3xl font-bold text-white mb-2">All Caught Up!</h2>
            <p className="text-gray-400">No pending orders. Great work!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;
