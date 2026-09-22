# NORMEX Plant Domain Memory

Plant Overview is the organisation-wide control room: summary, financial pressure, exceptions and navigation. Fleet is the master register for discovery, filtering and asset access. Asset is the complete single-asset workspace: master record, history and operational actions.

Requests controls resource demand. Availability shows present/future position and clashes. Movements controls physical relocation and transport. Defects controls restrictions and repairs. Maintenance controls servicing. Compliance controls certificates, inspections, evidence, expiry and holds. Suppliers controls source management.

Overview summarises; a domain page controls; an Asset page manages one record. Do not duplicate full domain workflows on Overview.

- Plant ID is immutable business identity; the internal Firestore key may differ.
- Project and location changes require controlled history.
- Defects and maintenance are workflows, not casual `plantAssets` field edits.
- Compliance evidence belongs in Compliance; documents are evidence, not the business record.
- Financial visibility requires approved permission.
- Unknown, incomplete, unavailable and failed data must remain truthful.
