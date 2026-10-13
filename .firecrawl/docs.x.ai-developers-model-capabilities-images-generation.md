#### [Model Capabilities](https://docs.x.ai/developers/model-capabilities/images/generation\#model-capabilities)

# [Image Generation](https://docs.x.ai/developers/model-capabilities/images/generation\#image-generation)

Copy for LLM [View as Markdown](https://docs.x.ai/developers/model-capabilities/images/generation.md)

[Create API key](https://console.x.ai/team/default/api-keys?utm_source=docs&utm_medium=referral&utm_campaign=developers-model-capabilities-images-generation&utm_content=article-api-key) [Try Playground](https://console.x.ai/team/default/image?mode=generate&utm_source=docs&utm_medium=referral&utm_campaign=developers-model-capabilities-images-generation&utm_content=playground-cta) [Meet grok-4.6](https://x.ai/news/grok-4-6)

Generate images from text prompts with Grok Imagine models. The API supports batch generation of multiple images, and control over aspect ratio, resolution, and quality.

* * *

## [Quick Start](https://docs.x.ai/developers/model-capabilities/images/generation\#quick-start)

Generate an image with a single API call:

PythonBashPython (OpenAI)JavaScript (OpenAI) JavaScript

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="A collage of London landmarks in a stenciled street‑art style",
    model="grok-imagine-image-2.0",
)

print(response.url)
```

```
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "A collage of London landmarks in a stenciled street‑art style"
  }'
```

```
from openai import OpenAI

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.images.generate(
    model="grok-imagine-image-2.0",
    prompt="A collage of London landmarks in a stenciled street‑art style",
)

print(response.data[0].url)
```

```
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
});

const response = await client.images.generate({
    model: "grok-imagine-image-2.0",
    prompt: "A collage of London landmarks in a stenciled street‑art style",
});

console.log(response.data[0].url);
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

const { image } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: "A collage of London landmarks in a stenciled street‑art style",
});

console.log(image.base64);
```

Images are returned as URLs by default. URLs are temporary, so download or process promptly. You can also request [base64 output](https://docs.x.ai/developers/model-capabilities/images/generation#base64-output) for embedding images directly.

* * *

## [Configuration](https://docs.x.ai/developers/model-capabilities/images/generation\#configuration)

### [Multiple Images](https://docs.x.ai/developers/model-capabilities/images/generation\#multiple-images)

Generate multiple images in a single request using the `sample_batch()` method and the `n` parameter. This returns a list of `ImageResponse` objects.

PythonPython (OpenAI)JavaScript (OpenAI) JavaScriptBash

```
import xai_sdk

client = xai_sdk.Client()

responses = client.image.sample_batch(
    prompt="A futuristic city skyline at night",
    model="grok-imagine-image-2.0",
    n=4,
)

for i, image in enumerate(responses):
    print(f"Variation {i + 1}: {image.url}")
```

```
from openai import OpenAI

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.images.generate(
    model="grok-imagine-image-2.0",
    prompt="A futuristic city skyline at night",
    n=4,
)

for i, image in enumerate(response.data):
    print(f"Variation {i + 1}: {image.url}")
```

```
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

const response = await client.images.generate({
    model: "grok-imagine-image-2.0",
    prompt: "A futuristic city skyline at night",
    n: 4,
});

response.data.forEach((image, i) => {
    console.log(`Variation ${i + 1}: ${image.url}`);
});
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

const { images } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: "A futuristic city skyline at night",
    n: 4,
});

images.forEach((image, i) => {
    console.log(`Variation ${i + 1}: ${image.base64.slice(0, 50)}...`);
});
```

```
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "A futuristic city skyline at night",
    "n": 4
  }'
```

### [Aspect Ratio](https://docs.x.ai/developers/model-capabilities/images/generation\#aspect-ratio)

Control image dimensions with the `aspect_ratio` parameter.

| Ratio | Use case |
| --- | --- |
| `1:1` | Social media, thumbnails |
| `16:9` / `9:16` | Widescreen, mobile, stories |
| `4:3` / `3:4` | Presentations, portraits |
| `3:2` / `2:3` | Photography |
| `2:1` / `1:2` | Banners, headers |
| `19.5:9` / `9:19.5` | Modern smartphone displays |
| `20:9` / `9:20` | Ultra-wide displays |
| `auto` | Model auto-selects the best ratio for the prompt |

PythonPython (OpenAI)JavaScript (OpenAI) JavaScriptBash

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="Mountain landscape at sunrise",
    model="grok-imagine-image-2.0",
    aspect_ratio="16:9",
)

print(response.url)
```

```
from openai import OpenAI

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.images.generate(
    model="grok-imagine-image-2.0",
    prompt="Mountain landscape at sunrise",
    extra_body={"aspect_ratio": "16:9"},
)

print(response.data[0].url)
```

```
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

const response = await client.images.generate({
    model: "grok-imagine-image-2.0",
    prompt: "Mountain landscape at sunrise",

    aspect_ratio: "16:9",
});

console.log(response.data[0].url);
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

const { image } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: "Mountain landscape at sunrise",
    aspectRatio: "16:9",
});

console.log(image.base64);
```

```
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "Mountain landscape at sunrise",
    "aspect_ratio": "16:9"
  }'
```

### [Resolution](https://docs.x.ai/developers/model-capabilities/images/generation\#resolution)

You can specify different resolutions of the output image. Currently supported image resolutions are:

- 1k
- 2k

PythonPython (OpenAI)JavaScript (OpenAI) JavaScriptBash

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="An astronaut performing EVA in LEO.",
    model="grok-imagine-image-2.0",
    resolution="2k"
)

print(response.url)
```

```
from openai import OpenAI

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.images.generate(
    model="grok-imagine-image-2.0",
    prompt="An astronaut performing EVA in LEO.",
    extra_body={"resolution": "2k"},
)

print(response.data[0].url)
```

```
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

const response = await client.images.generate({
    model: "grok-imagine-image-2.0",
    prompt: "An astronaut performing EVA in LEO.",

    resolution: "2k",
});

console.log(response.data[0].url);
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";

const { image } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: "An astronaut performing EVA in LEO.",
    providerOptions: {
        xai: { resolution: "2k" },
    },
});

console.log(image.base64);
```

```
curl -X POST https://api.x.ai/v1/images/generations \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $XAI_API_KEY" \
-d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "An astronaut performing EVA in LEO.",
    "resolution": "2k"
}'
```

### [Quality](https://docs.x.ai/developers/model-capabilities/images/generation\#quality)

Control generation quality with the optional `quality` parameter. Allowed values are `low` and `medium`. When omitted, the default is `medium`. The parameter is only supported for `grok-imagine-image-2.0`.

### [Base64 Output](https://docs.x.ai/developers/model-capabilities/images/generation\#base64-output)

For embedding images directly without downloading, request base64:

PythonPython (OpenAI)JavaScript (OpenAI) JavaScriptBash

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="A serene Japanese garden",
    model="grok-imagine-image-2.0",
    image_format="base64",
)

# Save to file
with open("garden.jpg", "wb") as f:
    f.write(response.image)
```

```
import base64
from openai import OpenAI

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.images.generate(
    model="grok-imagine-image-2.0",
    prompt="A serene Japanese garden",
    response_format="b64_json",
)

# Save to file
image_bytes = base64.b64decode(response.data[0].b64_json)
with open("garden.jpg", "wb") as f:
    f.write(image_bytes)
```

```
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

const response = await client.images.generate({
    model: "grok-imagine-image-2.0",
    prompt: "A serene Japanese garden",
    response_format: "b64_json",
});

// Save to file
const imageBuffer = Buffer.from(response.data[0].b64_json, "base64");
fs.writeFileSync("garden.jpg", imageBuffer);
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";
import fs from "fs";

const { image } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: "A serene Japanese garden",
});

// Save to file (AI SDK returns base64 by default)
const imageBuffer = Buffer.from(image.base64, "base64");
fs.writeFileSync("garden.jpg", imageBuffer);
```

```
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "A serene Japanese garden",
    "response_format": "b64_json"
  }'
```

### [Response Details](https://docs.x.ai/developers/model-capabilities/images/generation\#response-details)

The xAI SDK exposes additional metadata on the response object beyond the image URL or base64 data.

**Moderation** — Check whether the generated image passed content moderation:

Python

```
if response.respect_moderation:
    print(response.url)
else:
    print("Image filtered by moderation")
```

**Model** — Get the actual model used (resolving any aliases):

Python

```
print(f"Model: {response.model}")
```

* * *

## [Concurrent Requests](https://docs.x.ai/developers/model-capabilities/images/generation\#concurrent-requests)

When you need to generate multiple images with **different prompts**, such as generating unrelated images in parallel, use `AsyncClient` with `asyncio.gather` to fire requests concurrently. This is significantly faster than issuing them one at a time.

If you want multiple variations from the **same prompt**, use [`sample_batch()` with the `n` parameter\`](https://docs.x.ai/developers/model-capabilities/images/generation#multiple-images) instead. That generates all images in a single request and is the most efficient approach for same-prompt generation.

Python

```
import asyncio
import xai_sdk

async def generate_concurrently():
    client = xai_sdk.AsyncClient()

    # Each request uses a different prompt
    prompts = [\
        "A futuristic city skyline at sunset",\
        "A serene Japanese garden in winter",\
        "An astronaut floating above Earth",\
        "A medieval castle on a misty mountain",\
    ]

    # Fire all requests concurrently
    tasks = [\
        client.image.sample(\
            prompt=prompt,\
            model="grok-imagine-image-2.0",\
        )\
        for prompt in prompts\
    ]

    results = await asyncio.gather(*tasks)

    for prompt, result in zip(prompts, results):
        print(f"{prompt}: {result.url}")

asyncio.run(generate_concurrently())
```

* * *

## [Related](https://docs.x.ai/developers/model-capabilities/images/generation\#related)

- [Models](https://docs.x.ai/developers/models) — Available image models
- [Image Editing](https://docs.x.ai/developers/model-capabilities/images/editing) — Edit images with natural language
- [Image Generation Tool](https://docs.x.ai/developers/tools/image-generation) — Let Grok generate and edit images inside a conversation
- [Video Generation](https://docs.x.ai/developers/model-capabilities/video/generation) — Generate videos from text prompts
- [API Reference](https://docs.x.ai/developers/rest-api-reference) — Full endpoint documentation
- [Imagine API Landing Page](https://x.ai/api/imagine) — Showcase of the Imagine API in action

* * *

Last updated: August 13, 2026