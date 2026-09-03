# Practice kit (synthetic)

Personal rehearsal for **precertification** and **claims adjudication**.
Not a licensed TPA. Not Appwrite production. Not employer data.

Folder: [`practice/tpa/`](practice/tpa/README.md)  
Note: [`docs/TPA_PRACTICE_KIT.md`](docs/TPA_PRACTICE_KIT.md)

```bash
cd practice/tpa
PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. python3 -m tpa.cli data/tickets.json
PYTHONPATH=. python3 -m tpa.cli claims data/claims.json
```
