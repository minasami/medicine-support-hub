# Practice kit (synthetic)

Personal rehearsal. Not a licensed TPA. Not Bask. Not Appwrite production. Not employer data.

- Precert / claims: [`practice/tpa/`](practice/tpa/README.md)
- Programme pharmacy routing: [`practice/routing/`](practice/routing/README.md)

```bash
cd practice/tpa && PYTHONPATH=. python3 -m unittest discover -s tests -v
cd practice/routing && PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. python3 -m routing.cli data/orders.json
```
