# Pharmacy routing practice (synthetic)

Personal rehearsal: pick a **programme partner pharmacy** for a fulfilled medicine request.

- Not Bask Health. Not 503A/503B. Not US interstate compounding.
- Not Appwrite production. Not employer or patient data.
- Gates: stock → ship-to governorate → form the partner may handle → programme pin.

```bash
cd practice/routing
PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. python3 -m routing.cli data/orders.json
```
