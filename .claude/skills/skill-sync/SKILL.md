---
name: skill-sync
description: 'Trigger: crear una skill, editar un SKILL.md, cambiar sus frases de auto_invoke, regenerar la tabla de CLAUDE.md.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Crear una skill nueva en este repositorio'
    - 'Editar un SKILL.md existente'
    - 'Agregar o cambiar las frases de auto_invoke de una skill'
    - 'Regenerar la tabla de skills de CLAUDE.md'
    - 'Verificar que CLAUDE.md lista todas las skills'
---

## Activation Contract

Cargar esta skill antes de crear o editar cualquier archivo bajo
`.claude/skills/`.

## La tabla de CLAUDE.md es generada

Se construye desde `metadata.auto_invoke` de cada skill. Editar una fila a mano y
no la skill significa que el próximo sync lo revierte en silencio.

```bash
pnpm skills:sync           # reescribe la tabla
pnpm skills:sync --check   # falla si está desactualizada, no escribe nada
```

**Después de crear o cambiar una skill, corre el sync.** Una skill que nadie
conoce no gobierna nada.

## Forma de una skill

```
.claude/skills/{nombre}/SKILL.md
.claude/skills/{nombre}/assets/     opcional: scripts o plantillas
```

Frontmatter obligatorio:

```yaml
---
name: nombre-en-kebab-case
description: 'Trigger: ... . Una frase de qué gobierna.'
license: Apache-2.0
metadata:
  author: jhzl
  version: '1.0'
  auto_invoke:
    - 'Una acción, redactada como la diría el usuario'
---
```

Reglas de las frases:

- **Una fila por forma de decirlo, no una por skill.** La tabla se compara contra
  lo que el usuario realmente escribe, así que una skill a la que se llega de tres
  maneras lleva tres frases.
- En infinitivo y concretas: "Crear una ruta en apps/api", no "Trabajo de
  backend".
- Si una acción no está en la tabla, ninguna skill la cubre. No estires una skill
  ajena para que encaje.

## Qué va en una skill y qué no

Una skill dice **la regla y por qué existe**, no el tutorial del framework.

- Sí: la invariante, el incidente que la originó, el comando exacto, la tabla de
  decisión.
- No: repetir la documentación de NestJS, de zod o de Tailwind.

Si la regla se puede verificar con un test, el test manda y la skill solo dice
dónde vive.

## Verificación

`pnpm skills:sync --check` es lo que corre en CI. Falla si alguien agregó una
skill sin regenerar la tabla.
