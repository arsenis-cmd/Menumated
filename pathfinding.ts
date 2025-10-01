// File: backend/src/utils/pathfinding.ts
// How to name: backend/src/utils/pathfinding.ts

interface Position {
  x: number;
  y: number;
}

interface Node {
  position: Position;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: Node | null;
}

export class RobotPathfinding {
  private grid: number[][];
  private width: number;
  private height: number;

  constructor(grid: number[][]) {
    this.grid = grid;
    this.height = grid.length;
    this.width = grid[0].length;
  }

  /**
   * A* Pathfinding Algorithm
   * Returns array of positions from start to end
   */
  findPath(start: Position, end: Position): Position[] | null {
    // Validate positions
    if (!this.isValid(start) || !this.isValid(end)) {
      return null;
    }

    if (!this.isWalkable(start) || !this.isWalkable(end)) {
      return null;
    }

    const openList: Node[] = [];
    const closedList: Set<string> = new Set();

    // Create start node
    const startNode: Node = {
      position: start,
      g: 0,
      h: this.heuristic(start, end),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);

    while (openList.length > 0) {
      // Get node with lowest f score
      openList.sort((a, b) => a.f - b.f);
      const currentNode = openList.shift()!;

      // Add to closed list
      closedList.add(this.positionKey(currentNode.position));

      // Check if we reached the end
      if (this.isSamePosition(currentNode.position, end)) {
        return this.reconstructPath(currentNode);
      }

      // Check all neighbors
      const neighbors = this.getNeighbors(currentNode.position);

      for (const neighborPos of neighbors) {
        const neighborKey = this.positionKey(neighborPos);

        // Skip if in closed list
        if (closedList.has(neighborKey)) {
          continue;
        }

        // Calculate costs
        const gScore = currentNode.g + 1; // Assuming uniform cost
        const hScore = this.heuristic(neighborPos, end);
        const fScore = gScore + hScore;

        // Check if neighbor is in open list
        const existingNode = openList.find(n => 
          this.isSamePosition(n.position, neighborPos)
        );

        if (existingNode) {
          // Update if new path is better
          if (gScore < existingNode.g) {
            existingNode.g = gScore;
            existingNode.f = fScore;
            existingNode.parent = currentNode;
          }
        } else {
          // Add new node to open list
          const neighborNode: Node = {
            position: neighborPos,
            g: gScore,
            h: hScore,
            f: fScore,
            parent: currentNode
          };
          openList.push(neighborNode);
        }
      }
    }

    // No path found
    return null;
  }

  /**
   * Manhattan distance heuristic
   */
  private heuristic(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Get walkable neighbor positions
   */
  private getNeighbors(pos: Position): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      { x: 0, y: -1 },  // North
      { x: 1, y: 0 },   // East
      { x: 0, y: 1 },   // South
      { x: -1, y: 0 }   // West
    ];

    for (const dir of directions) {
      const newPos: Position = {
        x: pos.x + dir.x,
        y: pos.y + dir.y
      };

      if (this.isValid(newPos) && this.isWalkable(newPos)) {
        neighbors.push(newPos);
      }
    }

    return neighbors;
  }

  /**
   * Check if position is within grid bounds
   */
  private isValid(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.width &&
           pos.y >= 0 && pos.y < this.height;
  }

  /**
   * Check if position is walkable (not obstacle)
   */
  private isWalkable(pos: Position): boolean {
    return this.grid[pos.y][pos.x] === 0; // 0 = walkable
  }

  /**
   * Reconstruct path from end node to start
   */
  private reconstructPath(endNode: Node): Position[] {
    const path: Position[] = [];
    let current: Node | null = endNode;

    while (current !== null) {
      path.unshift(current.position);
      current = current.parent;
    }

    return path;
  }

  /**
   * Create unique key for position
   */
  private positionKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  /**
   * Check if two positions are the same
   */
  private isSamePosition(a: Position, b: Position): boolean {
    return a.x === b.x && a.y === b.y;
  }

  /**
   * Smooth path by removing unnecessary waypoints
   */
  smoothPath(path: Position[]): Position[] {
    if (path.length <= 2) return path;

    const smoothed: Position[] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;

      // Find farthest visible point
      for (let i = current + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[current], path[i])) {
          farthest = i;
        }
      }

      smoothed.push(path[farthest]);
      current = farthest;
    }

    return smoothed;
  }

  /**
   * Check if there's a clear line of sight between two points
   */
  private hasLineOfSight(a: Position, b: Position): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a.x + (dx * i / steps));
      const y = Math.round(a.y + (dy * i / steps));

      if (!this.isValid({ x, y }) || !this.isWalkable({ x, y })) {
        return false;
      }
    }

    return true;
  }
}

// File: backend/src/services/robotController.ts
// How to name: backend/src/services/robotController.ts

import { Robot, RestaurantLayout, Order } from '../models/schemas';
import { RobotPathfinding } from '../utils/pathfinding';
import { io } from '../index';

export class RobotController {
  private pathfinder: RobotPathfinding | null = null;
  private layout: any = null;

  async initialize() {
    // Load restaurant layout
    this.layout = await RestaurantLayout.findOne({ layout_id: 'main_floor' });
    
    if (this.layout) {
      this.pathfinder = new RobotPathfinding(this.layout.grid);
    }
  }

  /**
   * Assign robot to deliver an order
   */
  async assignRobotToOrder(orderId: string): Promise<boolean> {
    try {
      const order = await Order.findOne({ order_id: orderId });
      if (!order) return false;

      // Find available robot
      const robot = await Robot.findOne({ 
        status: 'idle',
        is_active: true,
        battery_level: { $gt: 20 }
      });

      if (!robot) {
        console.log('No available robots');
        return false;
      }

      // Calculate path from kitchen to table
      const kitchenPos = this.layout.locations.kitchen;
      const tablePos = await this.getTablePosition(order.table_number!);

      if (!this.pathfinder) {
        console.error('Pathfinder not initialized');
        return false;
      }

      const path = this.pathfinder.findPath(kitchenPos, tablePos);

      if (!path) {
        console.error('No path found');
        return false;
      }

      // Smooth the path
      const smoothedPath = this.pathfinder.smoothPath(path);

      // Update robot
      robot.status = 'navigating';
      robot.current_order_id = orderId;
      robot.current_task = {
        type: 'deliver_to_table',
        from: kitchenPos,
        to: tablePos,
        started_at: new Date()
      };
      robot.current_path = smoothedPath;

      await robot.save();

      // Update order
      order.assigned_to.robot_id = robot.robot_id;
      order.status = 'delivering';
      await order.save();

      // Emit real-time update
      io.emit('robot:assigned', {
        robot_id: robot.robot_id,
        order_id: orderId,
        path: smoothedPath
      });

      // Start robot movement simulation
      this.simulateRobotMovement(robot.robot_id);

      return true;
    } catch (error) {
      console.error('Robot assignment error:', error);
      return false;
    }
  }

  /**
   * Simulate robot movement along path
   */
  private async simulateRobotMovement(robotId: string) {
    const robot = await Robot.findOne({ robot_id: robotId });
    if (!robot || !robot.current_path || robot.current_path.length === 0) return;

    const path = robot.current_path;
    let currentIndex = 0;

    const moveInterval = setInterval(async () => {
      if (currentIndex >= path.length) {
        // Reached destination
        await this.handleRobotArrival(robotId);
        clearInterval(moveInterval);
        return;
      }

      // Move to next position
      const nextPos = path[currentIndex];
      robot.current_position = {
        x: nextPos.x,
        y: nextPos.y,
        facing: this.calculateFacing(
          currentIndex > 0 ? path[currentIndex - 1] : robot.current_position,
          nextPos
        )
      };

      await robot.save();

      // Emit position update
      io.emit('robot:position', {
        robot_id: robotId,
        position: robot.current_position,
        progress: ((currentIndex + 1) / path.length) * 100
      });

      currentIndex++;
    }, 1000); // Move every second
  }

  /**
   * Handle robot arrival at destination
   */
  private async handleRobotArrival(robotId: string) {
    const robot = await Robot.findOne({ robot_id: robotId });
    if (!robot) return;

    const order = await Order.findOne({ order_id: robot.current_order_id });
    if (!order) return;

    // Update order status
    order.status = 'delivered';
    order.completed_at = new Date();
    await order.save();

    // Update robot
    robot.status = 'returning';
    robot.stats.total_deliveries = (robot.stats.total_deliveries || 0) + 1;

    // Calculate return path to kitchen
    const returnPath = this.pathfinder!.findPath(
      robot.current_position,
      this.layout.locations.kitchen
    );

    if (returnPath) {
      robot.current_path = this.pathfinder!.smoothPath(returnPath);
      await robot.save();

      // Emit delivery complete
      io.emit('order:delivered', {
        order_id: order.order_id,
        table_number: order.table_number,
        robot_id: robotId
      });

      // Return to kitchen
      setTimeout(() => {
        this.returnRobotToKitchen(robotId);
      }, 2000);
    }
  }

  /**
   * Return robot to kitchen and mark as idle
   */
  private async returnRobotToKitchen(robotId: string) {
    const robot = await Robot.findOne({ robot_id: robotId });
    if (!robot) return;

    // Simulate return journey
    const path = robot.current_path;
    if (!path) return;

    let currentIndex = 0;
    const returnInterval = setInterval(async () => {
      if (currentIndex >= path.length) {
        // Back at kitchen
        robot.status = 'idle';
        robot.current_order_id = undefined;
        robot.current_task = undefined;
        robot.current_path = [];
        robot.current_position = this.layout.locations.kitchen;
        await robot.save();

        io.emit('robot:idle', { robot_id: robotId });
        clearInterval(returnInterval);
        return;
      }

      robot.current_position = {
        x: path[currentIndex].x,
        y: path[currentIndex].y,
        facing: robot.current_position.facing
      };
      await robot.save();

      io.emit('robot:position', {
        robot_id: robotId,
        position: robot.current_position
      });

      currentIndex++;
    }, 800);
  }

  /**
   * Get table position from layout
   */
  private async getTablePosition(tableNumber: number): Promise<{ x: number, y: number }> {
    const Table = require('../models/schemas').Table;
    const table = await Table.findOne({ table_number: tableNumber });
    return table?.location || { x: 0, y: 0 };
  }

  /**
   * Calculate facing direction based on movement
   */
  private calculateFacing(from: any, to: any): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'east' : 'west';
    } else {
      return dy > 0 ? 'south' : 'north';
    }
  }

  /**
   * Emergency stop all robots
   */
  async emergencyStopAll() {
    await Robot.updateMany(
      { status: { $in: ['navigating', 'delivering'] } },
      { status: 'idle', current_path: [] }
    );

    io.emit('robots:emergency_stop');
  }
}

export default new RobotController();
