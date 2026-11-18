---
name: clima
description: Obtiene el clima actual en local (sin API key) para la ubicacion del equipo o para una ciudad indicada. Usar cuando el usuario pida el clima, la temperatura, si va a llover o el tiempo en un lugar.
allowed-tools: Bash
---

# Clima local

Consulta el clima actual usando Open-Meteo (gratuito, sin clave) mediante el script `scripts/clima.ps1` de esta skill.

## Cómo ejecutarla

Desde la raíz del proyecto, ejecuta uno de estos comandos según lo que pida el usuario:

- Clima en la ubicación del equipo (aproximada por IP):
  `powershell -NoProfile -ExecutionPolicy Bypass -File ".claude/skills/clima/scripts/clima.ps1"`
- Clima en una ciudad:
  `powershell -NoProfile -ExecutionPolicy Bypass -File ".claude/skills/clima/scripts/clima.ps1" -Ciudad "Madrid"`
- Clima por coordenadas:
  `powershell -NoProfile -ExecutionPolicy Bypass -File ".claude/skills/clima/scripts/clima.ps1" -Lat 40.4168 -Lon -3.7038`

## Cómo responder

- Presenta el resultado en español, de forma breve: condición, temperatura (y sensación térmica), humedad, viento y precipitación.
- Indica la ubicación y la hora local que devuelve el script.
- Usa solo los datos que devuelve el script; no inventes pronósticos ni valores.
- Si el script falla (sin conexión, ciudad no encontrada), muestra el error tal cual y sugiere pasar `-Ciudad` o coordenadas.
- Esta skill muestra el clima actual, no pronósticos a varios días.
