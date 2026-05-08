# SouravTestClaude

A collection of interactive single-page web applications built with plain HTML, CSS, and JavaScript — no build tools or dependencies required.

## Applications

### Scientific Calculator (`calculator.html`)

A fully-featured dark-themed scientific calculator.

**Features:**
- Basic arithmetic with expression chaining (`+`, `−`, `×`, `÷`)
- Trigonometry: sin, cos, tan and inverses (sin⁻¹, cos⁻¹, tan⁻¹)
- Logarithms: log (base 10), ln, log₂
- Powers and roots: x², x³, xʸ, √x, ∛x
- Constants: π and e
- Special functions: n!, 1/x, |x|, %, eˣ, ±
- Memory: MC, MR, MS, M+, M−
- Degree / Radian toggle
- Live expression display with history
- Full keyboard support

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `0`–`9`, `.` | Digits |
| `+`, `-`, `*`, `/` | Operators |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last character |
| `Escape` | Clear all |
| `p` | Insert π |
| `e` | Insert e |
| `s` / `c` / `t` | sin / cos / tan |
| `l` / `n` | log / ln |
| `^` | Power (xʸ) |
| `%` | Percentage |
| `!` | Factorial |

---

### Annotated Martinez Memo (`index.html`)

An interactive annotated reader for Stanford Law Dean Jenny Martinez's March 2023 statement on freedom of speech and academic freedom.

**Features:**
- Select any passage to see related passages highlighted elsewhere in the document (keyword-based relevance scoring)
- AI-powered plain-English summaries of the legal concepts invoked in the selected text (requires an Anthropic API key)
- Sticky side panel with selected text echo, related passage links, and AI summary card
- Responsive layout for desktop and mobile

## Usage

Open either file directly in a browser — no server or installation needed.

```
open calculator.html
open index.html
```
