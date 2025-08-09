# IMMEDIATE NEXT STEPS TO START PRODUCTION CONVERSION

## STEP 1: DATABASE SCHEMA IMPLEMENTATION (First Priority)

### Add Real Marketplace Tables to Schema
```typescript
// Add to shared/schema.ts

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  email: varchar("email").unique().notNull(),
  category: varchar("category").notNull(),
  skills: jsonb("skills").$type<string[]>(),
  description: text("description"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0),
  completedOrders: integer("completed_orders").default(0),
  verificationStatus: varchar("verification_status").default("pending"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => agents.id),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category"),
  pricing: decimal("pricing", { precision: 10, scale: 2 }),
  deliveryTime: varchar("delivery_time"),
  tags: jsonb("tags").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id),
  agentId: varchar("agent_id").references(() => agents.id),
  serviceId: varchar("service_id").references(() => services.id),
  title: varchar("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  status: varchar("status").default("pending"),
  escrowStatus: varchar("escrow_status").default("held"),
  paymentIntentId: varchar("payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  deadline: timestamp("deadline")
});
```

## STEP 2: REPLACE MOCK DATA WITH DATABASE QUERIES

### Update AI Marketplace Routes
Replace hardcoded data in `server/routes/aiMarketplaceRoutes.ts`:

```typescript
// Replace this mock data:
const mockServices = [...]

// With real database queries:
router.get('/services', async (req, res) => {
  const services = await db
    .select()
    .from(services)
    .leftJoin(agents, eq(services.agentId, agents.id))
    .where(eq(services.isActive, true));
    
  res.json({ success: true, services });
});
```

## STEP 3: REAL AGENT REGISTRATION

### Update Registration Endpoint
```typescript
router.post('/agents/register', async (req, res) => {
  const { name, email, category, skills, hourlyRate, description } = req.body;
  
  // Validate input
  const agentData = {
    name,
    email,
    category,
    skills,
    hourlyRate: parseFloat(hourlyRate),
    description,
    verificationStatus: 'pending'
  };
  
  // Insert into database
  const [agent] = await db
    .insert(agents)
    .values(agentData)
    .returning();
    
  res.json({ success: true, agent });
});
```

## STEP 4: REAL STRIPE PAYMENT INTEGRATION

### Update Order Creation
```typescript
router.post('/create-order', isAuthenticated, async (req, res) => {
  const { serviceId, requirements } = req.body;
  
  // Get service details from database
  const service = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
    
  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(service.pricing * 100),
    currency: 'usd',
    metadata: { serviceId, customerId: req.user.id }
  });
  
  // Create order in database
  const [order] = await db
    .insert(orders)
    .values({
      customerId: req.user.id,
      serviceId,
      amount: service.pricing,
      paymentIntentId: paymentIntent.id
    })
    .returning();
    
  res.json({ 
    success: true, 
    clientSecret: paymentIntent.client_secret,
    orderId: order.id 
  });
});
```

## STEP 5: TEST WITH REAL DATA

### Create Test Agent
1. Use the registration form to create a real agent profile
2. Verify it's stored in the database
3. Test that it appears in the marketplace

### Create Test Service
1. Allow agents to add services through the interface
2. Store service details in database
3. Display real services in marketplace

### Process Test Order
1. Create order with real payment intent
2. Test escrow hold mechanism
3. Verify order appears in dashboards

## IMMEDIATE ACTION ITEMS (This Week)

1. **Add database schema** - Implement the tables above
2. **Run database migration** - `npm run db:push`
3. **Update services endpoint** - Replace mock data with DB queries
4. **Test agent registration** - Create first real agent
5. **Implement order creation** - Connect to real Stripe payment

## VALIDATION CHECKLIST

- [ ] Database tables created successfully
- [ ] Agent registration stores real data
- [ ] Services load from database
- [ ] Order creation connects to Stripe
- [ ] Money flow works (payment → escrow → payout)

This converts your demo into a functional MVP that can process real transactions.