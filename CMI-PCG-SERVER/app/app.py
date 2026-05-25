"""
CMI-PCG Backend - Flask app entrypoint

- App factory para arquitetura sólida.
- Evita import circular com Celery/tasks.
"""

from __future__ import annotations

from app.app_factory import create_app

app = create_app(register_blueprints=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
