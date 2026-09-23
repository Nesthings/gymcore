# TODO — GymCore

## Pendientes

- [x] Añadir imagen collage a la pantalla de login
- [ ] Revisar el opt-in del socio (compartir peso) para pulir detalles y detectar áreas de oportunidad
  - [ ] Consentimiento granular: definir si aplica solo a peso o también a medidas, fotos de progreso, notas de salud
  - [ ] Consentimiento explícito con fecha y versión (auditoría de cuándo se otorgó/revocó), no solo un booleano `share_weight`
  - [ ] Alcance por rol: hoy es binario para todo el staff; evaluar limitarlo a coach/admin vs. recepción
  - [ ] Revocación: definir qué pasa con el historial ya visto y ocultarlo retroactivamente (engagement, objetivos de peso)
  - [ ] Verificar que no haya fugas indirectas (p. ej. logros que cuentan registros de peso, reportes, dashboards)
  - [ ] Onboarding/UX: texto claro de qué implica compartir, estado visible del toggle y microcopy
  - [ ] Transparencia: notificar/indicar al socio cuándo el staff accede a su peso
  - [ ] Registrar cambios de consentimiento en la bitácora de auditoría
  - [ ] Aviso de privacidad / base legal del tratamiento de datos de salud