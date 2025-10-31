# Design Guidelines: Coin Railz Fintech AI Marketplace

## Design Approach
**Reference-Based**: Drawing from Stripe's fintech clarity and Coinbase's crypto credibility, with Material Design data visualization principles. This approach emphasizes trust through precise typography, structured layouts, and prominent numerical displays that instill confidence in financial data.

## Typography System

**Primary Font**: Inter (Google Fonts) for UI and data
**Accent Font**: Space Grotesk (Google Fonts) for headings and emphasis

Hierarchy:
- Large Numbers/Balances: Space Grotesk, 48px-72px, font-bold
- Section Headers: Space Grotesk, 24px-32px, font-semibold
- Data Labels: Inter, 14px, font-medium, uppercase tracking-wide
- Body Text: Inter, 16px, font-normal
- Small Data: Inter, 14px, font-medium
- Micro Labels: Inter, 12px, font-medium

## Layout System

**Spacing Primitives**: Tailwind units of 3, 4, 6, 8, 12, 16
- Card padding: p-6 or p-8
- Section spacing: space-y-6 or space-y-8
- Grid gaps: gap-6
- Inline spacing: space-x-3 or space-x-4

**Container Strategy**:
- Dashboard grid: max-w-7xl mx-auto px-6
- Component cards: rounded-xl with subtle shadows
- Multi-column layouts: 2-column (md:grid-cols-2), 3-column (lg:grid-cols-3) for widgets

## Component Library

### 1. Credits Dashboard Card
**Layout**: Prominent card (lg:col-span-2) featuring large balance display at top
- Balance amount: 72px Space Grotesk bold, with "Credits" label above in small caps
- Monthly spend indicator below with trend arrow icon (Heroicons)
- Secondary metrics in 2-column grid: "This Month" and "Last Month" comparisons
- Subtle divider line between sections
- "Add Credits" CTA button in bottom-right corner with blur backdrop

### 2. Transaction Success Badges
**Component Structure**: Compact status indicators with icon + text + count
- Badge container: inline-flex items with rounded-full backgrounds
- Left: Checkmark icon (Heroicons check-circle) at 20px
- Center: "Successful" text in 14px font-medium
- Right: Transaction count in pill badge (e.g., "247") with semi-transparent background
- Arrange in horizontal flex row with gap-3 spacing
- Include multiple badge types: Success, Pending, Completed

### 3. Running Total Widgets
**Grid Layout**: 3-column responsive grid (grid-cols-1 md:grid-cols-3)
- Each widget: Card with p-6, focused on single metric
- Top: Metric label in small caps (12px, tracking-wide)
- Center: Large number display (48px Space Grotesk) with dollar sign or unit
- Bottom: Percentage change indicator with up/down arrow icon + timeframe context
- Micro sparkline suggestion: <!-- CUSTOM CHART: 7-day trend sparkline -->
- Hover effect: Subtle scale and shadow increase

### 4. Testimonials Section
**Structure**: Full-width section with centered content (max-w-6xl)
- Header: "Trusted by AI Agents" in 32px Space Grotesk
- Overall rating display: 5.0 with large star icons (Font Awesome stars) at 24px
- Rating meta: "Based on 2,847 transactions" beneath in smaller text
- Testimonials grid: 3-column (lg:grid-cols-3) cards with:
  - Profile image (64px circle) or avatar initial
  - Agent name + role/type label
  - Star rating row (5 filled stars at 16px)
  - Quote text in 16px Inter with max 2-3 lines
  - Transaction count badge ("1,247 successful txns")
- Card treatment: Subtle borders, minimal shadow, clean backgrounds

### 5. Transaction History Table (Bonus Component)
**Data Display**: Clean table layout with alternating row treatment
- Headers: 12px uppercase tracking-wide font-medium
- Columns: Date, Amount, Status, Agent ID, Credits Used
- Status badges: Inline with icon indicators
- Amount column: Bold, right-aligned for scannability
- Pagination controls at bottom

## Navigation & Header
**Top Bar**: Fixed header with logo left, nav center, user balance right
- Logo: "Coin Railz" in Space Grotesk 20px font-semibold
- Nav items: Dashboard, Agents, Transactions, Settings
- User section: Credit balance pill + avatar dropdown
- Height: h-16 with backdrop blur for glassmorphic effect

## Icons
**Library**: Heroicons (solid and outline variants via CDN)
- Financial icons: currency-dollar, chart-bar, arrow-trending-up
- Status icons: check-circle, clock, x-circle
- UI icons: cog-6-tooth, user-circle, bell

## Animations
**Minimal & Purposeful**:
- Number counting animation on dashboard load (credits balance)
- Subtle fade-in for transaction success badges
- Smooth transitions on widget hover states (150ms)
- No scroll-triggered animations

## Images
**Not Applicable**: This is a dashboard/data interface - no hero images needed. All visual interest comes from data visualization, typography hierarchy, and structured layouts. Focus on clarity over imagery.

## Key Design Principles
1. **Data Prominence**: Financial numbers always largest, most prominent element
2. **Trust Indicators**: Use checkmarks, verified badges, and precise alignment
3. **Scannable Hierarchy**: Clear visual weight differences between primary/secondary data
4. **Breathing Room**: Generous whitespace around financial figures prevents claustrophobia
5. **Consistent Density**: Maintain similar information density across all widgets for cognitive ease