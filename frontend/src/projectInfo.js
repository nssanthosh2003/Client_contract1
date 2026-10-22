// TCS AgentAssist Portal structured metadata

export const APP_INFO = {
  name: "TCS AgentAssist Portal",
  fullName: "TCS AgentAssist Enterprise Portal",
  subtitle: "Airline Service Center & Commercial Portfolio",
  tagline: "Airline Booking Lifecycle, Operations & Contract Governance",
};

export const PROJECT = {
  name: "TCS AgentAssist Portal",
  kind: "Airline Service Center UI",
  tagline: "Service Center UI",
  title: "TCS AgentAssist — Airline Service Center Platform",
  summary:
    "An easy-to-use, high-efficiency application that helps airline customer service agents handle bookings efficiently. It empowers agents to manage the complete booking lifecycle from creation to post-booking service, assist travelers quickly across varied service scenarios, view and select seats via interactive seat maps, resolve booking issues in real time, interface seamlessly with Amadeus TCS AgentAssist, and maximize ancillary revenue opportunities.",
  highlights: [
    "Amadeus TCS AgentAssist Connected",
    "Interactive Cabin Seat Maps",
    "Real-Time Operational Diagnostics",
    "Ancillary Cross-Selling Engine",
  ],
  capabilities: [
    {
      id: "lifecycle",
      title: "Booking Lifecycle Management",
      desc: "Manage the complete booking journey from reservation creation through ticketing, itinerary modifications, and post-booking customer servicing.",
    },
    {
      id: "seats",
      title: "Interactive Seat Mapping",
      desc: "Browse dynamic cabin seat maps with real-time availability, seat attributes, family seating, and instantaneous seat assignment.",
    },
    {
      id: "troubleshoot",
      title: "Real-Time Troubleshooting",
      desc: "Identify and resolve booking discrepancies, payment flags, and system sync exceptions with live operational telemetry.",
    },
    {
      id: "amadeus",
      title: "Direct Amadeus Integration",
      desc: "Connect seamlessly with Amadeus TCS AgentAssist core airline systems for live schedule, inventory, and fare synchronization.",
    },
    {
      id: "ancillaries",
      title: "Ancillary & Cross-Selling",
      desc: "Unlock incremental revenue opportunities by recommending seat upgrades, additional baggage, lounge passes, and travel ancillaries.",
    },
    {
      id: "efficiency",
      title: "Multi-Scenario Support",
      desc: "Empower agents to assist passengers faster across complex service scenarios, reducing average handle time and elevating satisfaction.",
    },
  ],
  scopeSteps: [
    { num: "01", name: "Search Offers", detail: "Real-time flight schedules & pricing" },
    { num: "02", name: "Compare Offers", detail: "Side-by-side fare & routing matrix" },
    { num: "03", name: "Cart Management", detail: "Dynamic selections & hold items" },
    { num: "04", name: "Passenger Details", detail: "Contact & profile data capture" },
    { num: "05", name: "Select Seats", detail: "Interactive cabin visualizer" },
    { num: "06", name: "Add Ancillaries", detail: "Baggage, upgrades & custom services" },
    { num: "07", name: "Confirm Orders", detail: "Instant ticketing & confirmation" },
    { num: "08", name: "Admin Console", detail: "Privileged control & system config" },
  ],
  roles: [
    {
      code: "BASICUSER",
      title: "Front-Line Agent",
      desc: "Standard role assigned to agents responsible for booking management, passenger assistance, and itinerary updates across service scenarios.",
      permissions: "Booking creation, passenger modifications, seat selection, ancillary additions",
      badgeClass: "role-basic",
    },
    {
      code: "REFUND",
      title: "Finance & Service Admin",
      desc: "Administrative role with dedicated authorization to process cancellations, calculate penalty fees, and issue refund disbursements.",
      permissions: "Refund calculation, fee waivers, cancellation approvals, financial logging",
      badgeClass: "role-refund",
    },
    {
      code: "SUPERUSER",
      title: "System Administrator",
      desc: "Privileged administrative role governing system-wide configurations, Amadeus integration endpoints, user roles, and security policies.",
      permissions: "All application configurations, system provisioning, role assignments, audit logs",
      badgeClass: "role-super",
    },
  ],
};
