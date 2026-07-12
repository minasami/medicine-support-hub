# Adaptive search and governed growth release

## Search reliability

Guest medicine discovery now uses cached public metrics and facets plus a bounded browse path. Existing v4 clients are routed through the fast path while non-empty and filtered searches retain the original private indexed search plan.

Anonymous validation with a three-second statement timeout returned the initial 36 products in about 63 milliseconds. The bounded public facet set contains 1,085 values and returned in about 117 milliseconds. Direct anonymous access to the private search index remains denied.

## Governed growth

The platform maintains a bounded queue of 1,790 high-priority medicine data gaps covering price, scientific name, manufacturer, drug class, route, category, image, and price history.

Each web source has a trust tier, reliability limit, corroboration requirement, and allowed fields. Candidate confidence is capped by source reliability. New candidates always enter pending review, and automatic publication is disabled.

Source frequency adapts through failure backoff, zero-yield backoff, and productive-source acceleration within configured limits. Growth and source-trust counts are visible in the existing approval command center.

## Activation boundary

Scheduled provider synchronization remains disabled until a replacement server-side provider credential is configured and the administrator explicitly enables automatic synchronization. Human review remains required before public canonical publication.
