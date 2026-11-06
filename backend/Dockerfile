FROM node:20-bookworm-slim AS gltf
# sharp (the CLI's image library, pinned by the CLI to 0.33.x) ships its native code as
# optional per-platform packages (@img/sharp-linux-x64 + @img/sharp-libvips-linux-x64 here).
# npm drops an optional package silently when it cannot fetch it, and the CLI then fails on
# every model with "Could not load the sharp module". So ask for them explicitly and stop
# the build if they are not there, whatever the CPU (the glob also matches an arm64 build).
RUN npm install -g --include=optional @gltf-transform/cli@4.1.1 \
    && cd /usr/local/lib/node_modules/@gltf-transform/cli/node_modules \
    && ls sharp/package.json @img/sharp-linux*/lib/sharp-*.node @img/sharp-libvips-linux*/lib/libvips-cpp.so.* \
    && npm cache clean --force

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# fonts-dejavu-core: the estimate PDF's font (app/routers/estimate.py). ReportLab's built-in
# Helvetica has no Cyrillic, so a Russian PDF would otherwise print black boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libffi-dev \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Compresses uploaded 3D models (meshopt geometry, WebP textures): see
# app/services/glb_optimizer.py. Only the node binary and the CLI are copied in from the
# build stage; Debian's own npm would pull ~300 MB of packages. Pinned: the settings were
# checked by eye against this version.
#
# The CLI's image library (sharp) needs an x86-64-v2 CPU, and its WebAssembly build needs
# SSE4.1. A machine without them (the production VPS reports a bare "QEMU Virtual CPU" with
# SSE2 only) cannot run it at all; the image must still build there, and the optimizer then
# fails cleanly (task status "failed") and the original models are served. So the check
# below reports, never fails. It loads sharp itself: `--version` alone never touches it.
COPY --from=gltf /usr/local/bin/node /usr/local/bin/node
COPY --from=gltf /usr/local/lib/node_modules/@gltf-transform /usr/local/lib/node_modules/@gltf-transform
RUN ln -s /usr/local/lib/node_modules/@gltf-transform/cli/bin/cli.js /usr/local/bin/gltf-transform \
    && ((gltf-transform --version \
         && node -e "require('/usr/local/lib/node_modules/@gltf-transform/cli/node_modules/sharp'); console.log('sharp loads')") \
        || echo "WARNING: gltf-transform/sharp cannot run on this CPU; 3D models will be served uncompressed")

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
