GenZen is a personal workspace for working with AI image models — a tool built
for one person's use, not a product.

It does four things. Fan one prompt across several models and compare the
results side by side. Run non-destructive variation flows on what comes back.
Arrange results spatially on an infinite canvas. Generate video from a prompt
or a starting image.

Every generated or uploaded asset is one `user_images` row, and the same row is
the library card, the canvas tile and the Activity entry. Nothing is duplicated
between views; a canvas image _is_ a library image.

## What it explicitly is not

- **Not a product.** No signup, no billing, no support, no roadmap. It is public
  because there is no reason for it not to be. MIT licensed.
- **Not multi-tenant.** It has real accounts, password auth and per-user
  isolation, but no orgs, teams, roles or sharing.
- **Not a general image editor.** It generates, organizes and keeps images. It
  does not do layers, masks or pixel editing.
- **Not tied to a vendor.** Plain Postgres, generic S3 and Node, on Next. It
  deploys to Railway or anywhere else; nothing proprietary holds a piece of it.

## Where it fits

One of the single-purpose apps in this workspace: narrow surface, one job done
well, durable state so nothing is lost when the tab closes. Its sibling
`~/repos/bootsy` is the reference implementation for the stack.

## The surface

A short list of screens and nothing else — Explore, Images, Video, Activity,
Trash, Lab, Account, plus Canvas, which is deliberately not in the rail while it
is in development. There is no Settings route; Account is the settings area. If
something does not serve generating and keeping images, it was cut on purpose.
