# Agent Note: Brand icons are traced from a PNG

Status: implemented

English | [中文](2026-09-15-brand-icon-from-png.zh.md)

## Problem

A private deployment serves three brand SVGs — the icon, the favicon, and the wordmark — and each reaches every visitor's browser. An SVG is a document the browser interprets, not only a picture: it can carry script, event handlers, and references that load from elsewhere. The icon comes from an operator's upload or from an image model. Neither can be trusted to produce a safe document, and neither reliably produces a clean one: a model's output is a raster, and an operator's file may carry editor metadata, embedded bitmaps, or fixed colours that ignore the page theme.

## Decision

The icon always enters as a PNG, and every SVG leaves this toolchain's own writer. `@lyness/lyn-host-brand-icon` reads the PNG header before decoding, flattens the image onto white, treats pixels darker than mid-grey as ink, refuses what cannot make an icon, crops to the ink, and traces it with the black-and-white preset of `@neplex/vectorizer`. It moves each traced shape's offset into its coordinates, so the icon is plain paths in `currentColor` inside a box exactly the size of the ink, and it centres the same paths on a square favicon that turns white under a dark colour scheme.

`isBrandSvg` accepts exactly the documents the icon and wordmark packages write: a root element whose size matches its view box, an optional fixed dark-scheme rule, and paths whose data holds only move, line, curve, and close commands. It is a grammar of the output rather than a filter over arbitrary SVG, so no input shape can pass through it that these packages did not write.

## Alternatives considered

**Accept SVG uploads and sanitise them.** An operator with a vector original keeps its full precision. Sanitising SVG means keeping an allowlist current against every element, attribute, and URL form a browser acts on, and it still lets through structure and colours that do not follow the page theme. Tracing a PNG costs precision on vector originals and removes uploaded SVG as a category.

**potrace.** The reference tracer for black-and-white images, with the cleanest curves. Its JavaScript ports are GPL-2.0, which would attach source-disclosure obligations to a private deployment package that ships it.

**imagetracerjs.** Public-domain and pure JavaScript. It has had no release since 2023, so a defect in it would have no upstream fix.

**A separate PNG decoder, such as pngjs, in front of the tracer.** A familiar pure-JavaScript dependency. `@neplex/vectorizer` already decodes images and traces raw RGBA pixels, so a second decoder would add a dependency without removing any code.

**Clean the tracer's SVG with a general SVG optimiser.** The tracer writes an XML declaration, a comment, and a transform on every path, and an optimiser would tidy them. The document's form would then be defined by two libraries' behaviour rather than by this package, and verifying it would still need the grammar this package writes directly.

## Consequences

Tracing runs in a native addon. `@neplex/vectorizer` publishes prebuilt binaries for 14 targets, including macOS, Linux, and Windows, and it is pinned to exactly 0.1.0 because a pre-1.0 tracer may change its output in any release; a platform without a prebuilt binary cannot load it.

The brightness threshold discards colour. A multi-colour logo becomes one colour, and a light-coloured mark on white is refused as having no ink. An image whose four corners are all dark is refused as a dark background, which also refuses a mark that happens to fill all four corners.

Each bound comes from the Web shell or from tracing: at least 1024 pixels a side so curves fit cleanly, at most 4096 so one decode stays bounded, 1:1 to 1.4:1 so the icon fits the 24px-high sidebar row beside the name, and at most 64 shapes so a photograph is refused rather than traced into hundreds of paths. The favicon's mark spans 96% of its square, matching the shell's own favicon at 96.6%.
