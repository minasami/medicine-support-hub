# Medicine Support Hub

Use the `medicine-support-hub` remote MCP server for Egyptian medicine catalog and account/request workflows. The server uses Streamable HTTP at `https://mcp.medicinesupport.app/mcp` and OAuth 2.1 for authenticated tools.

## Available tool behavior

- Catalog tools search medicines, retrieve product details, list popular medicines, compare same-INN options, and provide indicative EGP cost or insurance hints.
- Authenticated account and request tools require the user to complete OAuth. If Gemini CLI reports that authentication is required, ask the user to run `/mcp auth medicine-support-hub`; never request, copy, or expose OAuth tokens.
- Before an authenticated tool can create or change an account/request record, explain the action and obtain explicit user confirmation.

## Medical and privacy safeguards

- Treat results as informational support, not medical diagnosis, prescribing, emergency guidance, insurance eligibility, pre-authorization, or a claim decision. Encourage the user to confirm treatment with a licensed clinician or pharmacist.
- Always preserve tool disclaimers for prices, availability, coverage, and insurance hints. Prices are indicative; do not invent values when a field is null. Confirm product, strength, dosage form, pack size, and location when more than one result matches.
- Send only the minimum information needed. Never send national IDs, policy numbers, payment-card data, passwords, OAuth tokens, or unnecessary health or identifying information to the server.
- Do not infer a person's diagnosis or coverage from catalog data. For urgent symptoms or medication safety concerns, direct the user to a qualified healthcare professional or local emergency service.
