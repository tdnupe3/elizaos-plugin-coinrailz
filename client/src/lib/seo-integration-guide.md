# SEO Integration Guide for Conversion Tracking

## Conversion Utilities Integration

The `conversion-utils.ts` file provides enterprise-grade conversion tracking functions that need to be integrated into success callbacks throughout the application.

### Required Integrations

#### 1. Authentication Success Callbacks

**File: `client/src/pages/signup.tsx` or auth service**
```typescript
import { trackRegistrationSuccess } from '@/lib/conversion-utils';

// In signup success handler
const handleSignupSuccess = (user) => {
  trackRegistrationSuccess(user.id, 'email'); // or 'coinbase', etc.
  // ... existing success logic
};
```

**File: `client/src/pages/signin.tsx` or auth service**
```typescript
import { trackLoginSuccess } from '@/lib/conversion-utils';

// In login success handler  
const handleLoginSuccess = (user) => {
  trackLoginSuccess(user.id, 'email'); // or 'coinbase', etc.
  // ... existing success logic
};
```

#### 2. Payment Success Callbacks

**File: Payment processing components**
```typescript
import { trackPaymentSuccess } from '@/lib/conversion-utils';

// In payment success handler
const handlePaymentSuccess = (transaction) => {
  trackPaymentSuccess(
    transaction.id,
    transaction.amount,
    transaction.currency,
    transaction.paymentMethod,
    transaction.serviceType
  );
  // ... existing success logic
};
```

#### 3. P2P Transfer Success Callbacks

**File: P2P transfer components**
```typescript
import { trackP2PTransferSuccess } from '@/lib/conversion-utils';

// In transfer success handler
const handleTransferSuccess = (transfer) => {
  trackP2PTransferSuccess(
    transfer.id,
    transfer.amount,
    transfer.currency,
    transfer.fromUser,
    transfer.toUser
  );
  // ... existing success logic
};
```

#### 4. AI Agent Marketplace Success Callbacks

**File: AI agent hiring components**
```typescript
import { trackAgentHireSuccess } from '@/lib/conversion-utils';

// In agent hire success handler
const handleAgentHireSuccess = (order) => {
  trackAgentHireSuccess(
    order.agentId,
    order.amount,
    order.currency,
    order.serviceCategory
  );
  // ... existing success logic
};
```

### GA4 Custom Dimensions Setup

In Google Analytics 4, configure these custom dimensions:
1. `fintech_action` - Text dimension for tracking fintech-specific actions
2. `user_type` - Text dimension for customer segmentation  
3. `service_type` - Text dimension for service category tracking

### Testing Conversion Tracking

1. Enable GA4 DebugView in your GA4 property
2. Add `?debug_mode=true` to your testing URLs
3. Verify events appear with proper transaction_id, value, and custom parameters
4. Check that ecommerce data flows correctly to GA4 reports

### Performance Monitoring

The system tracks Core Web Vitals automatically:
- **LCP** (Largest Contentful Paint) - Page loading performance
- **FID** (First Input Delay) - Page interactivity 
- **CLS** (Cumulative Layout Shift) - Visual stability

These metrics are automatically sent to GA4 for SEO performance monitoring.