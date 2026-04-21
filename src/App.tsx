import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import './App.css'

type OrderStatus = 'pending' | 'en-route' | 'delivered'
type Order = {
  id: string
  customerName: string
  location: [number, number]
  items: string[]
  orderedAt: number
  expectedFulfilmentAt: number
  status: OrderStatus
  assignedDriverId?: string
  /** When the driver picked up / left for delivery (used for travel time). */
  assignedAt?: number
  deliveredAt?: number
}
type Driver = {
  id: string
  name: string
  isAvailable: boolean
  currentLocation: [number, number]
  activeOrderId?: string
}

const RESTAURANT_LOCATION: [number, number] = [55.8797, -4.3112]
const MILES_TO_METERS = 1609.34
/** Base simulated travel at speed multiplier 1: duration scales with distance (miles). */
const DELIVERY_MS_PER_MILE = 12_000
const MIN_DELIVERY_MS = 3_000
const EARTH_RADIUS_MILES = 3958.8
const MENU_ITEMS = ['Margherita Pizza', 'Pepperoni Pizza', 'Chicken Burger', 'Veggie Wrap', 'Fries', 'Caesar Salad', 'Garlic Bread', 'Cheesecake']
const CUSTOMER_NAMES = ['Ava', 'Noah', 'Olivia', 'Luca', 'Mia', 'Leo', 'Isla', 'Jack']
const rand = (min: number, max: number) => Math.random() * (max - min) + min

function randomItems() {
  const count = Math.floor(rand(1, 5))
  return [...MENU_ITEMS].sort(() => 0.5 - Math.random()).slice(0, count)
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_MILES * c
}

/** Higher speed multiplier = shorter delivery time (drivers move faster). */
function deliveryDurationMs(order: Order, speedMultiplier: number): number {
  const scale = Math.max(0.05, speedMultiplier)
  const miles = haversineMiles(RESTAURANT_LOCATION, order.location)
  return Math.max(MIN_DELIVERY_MS / scale, (miles * DELIVERY_MS_PER_MILE) / scale)
}

function reconcileDriversWithOrders(orders: Order[], drivers: Driver[]): boolean {
  let changed = false
  const enRouteByDriver = new Map<string, Order[]>()
  for (const order of orders) {
    if (order.status === 'en-route' && order.assignedDriverId) {
      const list = enRouteByDriver.get(order.assignedDriverId) ?? []
      list.push(order)
      enRouteByDriver.set(order.assignedDriverId, list)
    }
  }
  const driverIds = new Set(drivers.map((d) => d.id))
  for (const order of orders) {
    if (order.status === 'en-route' && order.assignedDriverId && !driverIds.has(order.assignedDriverId)) {
      order.status = 'pending'
      order.assignedDriverId = undefined
      order.assignedAt = undefined
      changed = true
    }
  }
  for (const driver of drivers) {
    const list = (enRouteByDriver.get(driver.id) ?? []).filter((o) => o.status === 'en-route')
    if (list.length === 0) {
      if (!driver.isAvailable || driver.activeOrderId !== undefined) {
        driver.isAvailable = true
        driver.activeOrderId = undefined
        changed = true
      }
      continue
    }
    if (list.length > 1) {
      list.sort((a, b) => a.orderedAt - b.orderedAt)
      const [, ...dupes] = list
      for (const o of dupes) {
        o.status = 'pending'
        o.assignedDriverId = undefined
        o.assignedAt = undefined
        changed = true
      }
    }
    const active = orders.find((o) => o.status === 'en-route' && o.assignedDriverId === driver.id)
    if (active) {
      if (!driver.isAvailable || driver.activeOrderId !== active.id) {
        driver.isAvailable = false
        driver.activeOrderId = active.id
        changed = true
      }
    }
  }
  return changed
}

function pointWithinRadiusMiles(center: [number, number], radiusMiles: number): [number, number] {
  const radiusKm = radiusMiles * 1.60934
  const distanceKm = Math.sqrt(Math.random()) * radiusKm
  const bearing = rand(0, 2 * Math.PI)
  const lat1 = (center[0] * Math.PI) / 180
  const lon1 = (center[1] * Math.PI) / 180
  const angularDistance = distanceKm / 6371
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing))
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2))
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI]
}

function App() {
  const [driverCount, setDriverCount] = useState(2)
  const [orderFrequencySeconds, setOrderFrequencySeconds] = useState(3.5)
  const [radiusMiles, setRadiusMiles] = useState(20)
  /** 1 = default; 2 = twice as fast, etc. */
  const [driverSpeed, setDriverSpeed] = useState(1)
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([
    { id: 'd1', name: 'Driver 1', isAvailable: true, currentLocation: RESTAURANT_LOCATION },
    { id: 'd2', name: 'Driver 2', isAvailable: true, currentLocation: RESTAURANT_LOCATION },
  ])
  const ordersRef = useRef<Order[]>([])
  const driversRef = useRef<Driver[]>([])
  const driverSpeedRef = useRef(driverSpeed)

  useEffect(() => {
    driverSpeedRef.current = driverSpeed
  }, [driverSpeed])

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    driversRef.current = drivers
  }, [drivers])

  useEffect(() => {
    setDrivers((prev) => {
      const nextDrivers: Driver[] = []
      for (let i = 1; i <= driverCount; i += 1) {
        const id = `d${i}`
        const existing = prev.find((driver) => driver.id === id)
        nextDrivers.push(
          existing ?? {
            id,
            name: `Driver ${i}`,
            isAvailable: true,
            currentLocation: RESTAURANT_LOCATION,
          },
        )
      }
      return nextDrivers
    })

    setOrders((prev) =>
      prev.map((order) => {
        if (!order.assignedDriverId) return order
        const driverNumber = Number(order.assignedDriverId.replace('d', ''))
        if (Number.isNaN(driverNumber) || driverNumber <= driverCount) return order
        if (order.status !== 'en-route') return order
        return {
          ...order,
          status: 'pending',
          assignedDriverId: undefined,
          assignedAt: undefined,
        }
      }),
    )
  }, [driverCount])

  useEffect(() => {
    const intakeTimer = setInterval(() => {
      const now = Date.now()
      const newOrder: Order = {
        id: `ORD-${Math.floor(now / 1000)}-${Math.floor(rand(100, 999))}`,
        customerName: CUSTOMER_NAMES[Math.floor(rand(0, CUSTOMER_NAMES.length))],
        location: pointWithinRadiusMiles(RESTAURANT_LOCATION, Math.max(1, radiusMiles)),
        items: randomItems(),
        orderedAt: now,
        expectedFulfilmentAt: now + Math.floor(rand(20, 55)) * 60_000,
        status: 'pending',
      }
      setOrders((prev) => [newOrder, ...prev].slice(0, 80))
    }, Math.max(0.5, orderFrequencySeconds) * 1000)
    return () => clearInterval(intakeTimer)
  }, [orderFrequencySeconds, radiusMiles])

  useEffect(() => {
    const assignmentTimer = setInterval(() => {
      const nextOrders = ordersRef.current.map((order) => ({ ...order }))
      const nextDrivers = driversRef.current.map((driver) => ({ ...driver }))
      let hasChanges = reconcileDriversWithOrders(nextOrders, nextDrivers)

      for (const order of nextOrders) {
        if (order.status !== 'pending') continue
        const availableDriver = nextDrivers.find(
          (driver) =>
            driver.isAvailable &&
            !nextOrders.some((o) => o.status === 'en-route' && o.assignedDriverId === driver.id),
        )
        if (!availableDriver) break
        order.status = 'en-route'
        order.assignedDriverId = availableDriver.id
        order.assignedAt = Date.now()
        availableDriver.isAvailable = false
        availableDriver.activeOrderId = order.id
        availableDriver.currentLocation = RESTAURANT_LOCATION
        hasChanges = true
      }

      if (hasChanges) {
        setOrders(nextOrders)
        setDrivers(nextDrivers)
      }
    }, 1000)
    return () => clearInterval(assignmentTimer)
  }, [])

  useEffect(() => {
    const completionTimer = setInterval(() => {
      const now = Date.now()
      const nextOrders = ordersRef.current.map((order) => ({ ...order }))
      const nextDrivers = driversRef.current.map((driver) => ({ ...driver }))
      let hasChanges = reconcileDriversWithOrders(nextOrders, nextDrivers)

      const busyWithOrder = nextDrivers.filter((d) => !d.isAvailable && d.activeOrderId)
      if (busyWithOrder.length === 0) {
        if (hasChanges) {
          setOrders(nextOrders)
          setDrivers(nextDrivers)
        }
        return
      }

      for (const driver of busyWithOrder) {
        const orderId = driver.activeOrderId
        if (!orderId) continue
        const targetOrder = nextOrders.find((o) => o.id === orderId && o.status === 'en-route')
        if (!targetOrder || targetOrder.assignedDriverId !== driver.id) continue
        if (targetOrder.assignedAt === undefined) {
          targetOrder.assignedAt = now
          hasChanges = true
          continue
        }
        if (now - targetOrder.assignedAt < deliveryDurationMs(targetOrder, driverSpeedRef.current)) continue
        targetOrder.status = 'delivered'
        targetOrder.deliveredAt = now
        targetOrder.assignedAt = undefined
        const d = nextDrivers.find((x) => x.id === driver.id)
        if (d) {
          d.isAvailable = true
          d.activeOrderId = undefined
          d.currentLocation = RESTAURANT_LOCATION
        }
        hasChanges = true
      }

      if (hasChanges) {
        setOrders(nextOrders)
        setDrivers(nextDrivers)
      }
    }, 500)
    return () => clearInterval(completionTimer)
  }, [])

  const activeOrders = useMemo(() => orders.filter((order) => order.status !== 'delivered'), [orders])
  const deliveredOrders = useMemo(() => orders.filter((order) => order.status === 'delivered').slice(0, 15), [orders])
  const activeDeliveries = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'en-route' && order.assignedDriverId)
        .map((order) => ({
          id: order.id,
          driverId: order.assignedDriverId as string,
          points: [RESTAURANT_LOCATION, order.location] as LatLngExpression[],
        })),
    [orders],
  )

  return (
    <main className="layout">
      <header>
        <h1>Restaurant Dispatch Simulator</h1>
        <div className="controls">
          <label className="driver-config">
            Drivers:
            <input
              type="number"
              min={1}
              max={20}
              value={driverCount}
              onChange={(event) => setDriverCount(Number(event.target.value) || 1)}
            />
          </label>
          <label className="driver-config">
            Order Every (sec):
            <input
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              value={orderFrequencySeconds}
              onChange={(event) => setOrderFrequencySeconds(Number(event.target.value) || 0.5)}
            />
          </label>
          <label className="driver-config">
            Radius (miles):
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={radiusMiles}
              onChange={(event) => setRadiusMiles(Number(event.target.value) || 1)}
            />
          </label>
          <label className="driver-config">
            Driver speed (×):
            <input
              type="number"
              min={0.25}
              max={8}
              step={0.25}
              value={driverSpeed}
              onChange={(event) => setDriverSpeed(Math.max(0.25, Number(event.target.value) || 1))}
            />
          </label>
        </div>
      </header>
      <section className="map-panel">
        <MapContainer center={RESTAURANT_LOCATION} zoom={11} scrollWheelZoom className="map">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Circle center={RESTAURANT_LOCATION} radius={Math.max(1, radiusMiles) * MILES_TO_METERS} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.08 }} />
          <Marker position={RESTAURANT_LOCATION}><Popup>Restaurant (Great Western Rd)</Popup></Marker>
          {activeOrders.map((order) => (
            <Marker key={order.id} position={order.location}>
              <Popup><strong>{order.id}</strong><p>{order.customerName}</p><p>Status: {order.status}</p></Popup>
            </Marker>
          ))}
          {activeDeliveries.map((delivery) => (
            <Polyline key={delivery.id} positions={delivery.points} color="#f97316" weight={3}>
              <Tooltip permanent direction="center" className="delivery-line-label">
                {delivery.driverId}
              </Tooltip>
            </Polyline>
          ))}
        </MapContainer>
      </section>
      <section className="status-grid">
        <div className="card">
          <h2>Drivers</h2>
          {drivers.map((driver) => <p key={driver.id}>{driver.name}: {driver.isAvailable ? 'Available' : `On ${driver.activeOrderId}`}</p>)}
        </div>
        <div className="card">
          <h2>Open Orders</h2>
          <ul>
            {activeOrders.slice(0, 12).map((order) => (
              <li key={order.id}>
                <strong>{order.id}</strong> - {order.items.join(', ')} - ETA {new Date(order.expectedFulfilmentAt).toLocaleTimeString()} - {order.status}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Delivered (History)</h2>
          <ul>
            {deliveredOrders.map((order) => (
              <li key={order.id}>
                <strong>{order.id}</strong> - delivered at {order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString() : '-'}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App
