# TPA practice kit (synthetic)

**Not** a licensed TPA, not Nextcare/MedNet production, not employer data.

Copied into Medicine Support Hub so recruiters open **one** repo.
Original standalone copy: [minasami/medical-assistance-system](https://github.com/minasami/medical-assistance-system).

## Run from this folder

```bash
cd practice/tpa
PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. python3 -m tpa.cli data/tickets.json
PYTHONPATH=. python3 -m tpa.cli claims data/claims.json
```

- Precert: eligible → complete → covered → necessary.
- Adjudication: then tariff, copay, auth match, duplicate. Auth is not a cheque.
