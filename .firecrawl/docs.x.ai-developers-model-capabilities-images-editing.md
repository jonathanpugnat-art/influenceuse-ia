#### [Model Capabilities](https://docs.x.ai/developers/model-capabilities/images/editing\#model-capabilities)

# [Image Editing](https://docs.x.ai/developers/model-capabilities/images/editing\#image-editing)

Copy for LLM [View as Markdown](https://docs.x.ai/developers/model-capabilities/images/editing.md)

[Create API key](https://console.x.ai/team/default/api-keys?utm_source=docs&utm_medium=referral&utm_campaign=developers-model-capabilities-images-editing&utm_content=article-api-key) [Try Playground](https://console.x.ai/team/default/image?mode=edit&utm_source=docs&utm_medium=referral&utm_campaign=developers-model-capabilities-images-editing&utm_content=playground-cta) [Meet grok-4.6](https://x.ai/news/grok-4-6)

Edit an existing image by providing a source image along with your prompt. The model understands the image content and applies your requested changes.

The OpenAI SDK's `images.edit()` method is not supported for image editing because it uses `multipart/form-data`, while the xAI API requires `application/json`. Use the xAI SDK, Vercel AI SDK, or direct HTTP requests instead.

With the xAI SDK, use the same `sample()` method; just add the `image_url` parameter:

PythonBash JavaScript

```
import base64
import xai_sdk

client = xai_sdk.Client()

# Load image from file and encode as base64
with open("photo.png", "rb") as f:
    image_data = base64.b64encode(f.read()).decode("utf-8")

response = client.image.sample(
    prompt="Render this as a pencil sketch with detailed shading",
    model="grok-imagine-image-2.0",
    image_url=f"data:image/png;base64,{image_data}",
)

print(response.url)
```

```
# Using a public URL as the source image
curl -X POST https://api.x.ai/v1/images/edits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "Render this as a pencil sketch with detailed shading",
    "image": {
      "url": "https://docs.x.ai/assets/api-examples/images/style-realistic.png",
      "type": "image_url"
    }
  }'
```

```
import { xai } from "@ai-sdk/xai";
import { generateImage } from "ai";
import fs from "fs";

// Load image and encode as base64
const imageBuffer = fs.readFileSync("photo.png");
const base64Image = imageBuffer.toString("base64");

const { image } = await generateImage({
    model: xai.image("grok-imagine-image-2.0"),
    prompt: {
        text: "Render this as a pencil sketch with detailed shading",
        images: [`data:image/png;base64,${base64Image}`],
    },
});

console.log(image.base64);
```

You can provide the source image as:

- A **public URL** pointing to an image
- A **base64-encoded data URI** (e.g., `data:image/jpeg;base64,...`)
- A **`file_id`** from the [Files API](https://docs.x.ai/developers/files) — see [Imagine → Files API Integration](https://docs.x.ai/developers/model-capabilities/imagine/files/inputs)

* * *

## [Multi-turn editing](https://docs.x.ai/developers/model-capabilities/images/editing\#multi-turn-editing)

Chain multiple edits together by using each output as the input for the next. This enables iterative refinement; start with a base image and progressively add details, adjust styles, or make corrections.

![1. Initial](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fmulti-turn-initial.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![2. Modify Furniture](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fmulti-turn-modify-furniture.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![3. Adjust lighting](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fmulti-turn-evening-lighting.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)

PythonBash

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="A modern living room with large windows overlooking the city",
    model="grok-imagine-image-2.0",
)

print(response.url)
```

```
curl -X POST https://api.x.ai/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "prompt": "A modern living room with large windows overlooking the city",
    "model": "grok-imagine-image-2.0"
  }'
```

1\. Initial2\. Modify Furniture3\. Adjust lighting

* * *

## [Style transfer](https://docs.x.ai/developers/model-capabilities/images/editing\#style-transfer)

The `grok-imagine-image-2.0` model supports a wide range of visual styles, from ultra-realistic photography to anime, oil paintings, and pencil sketches. Transform existing images by describing the desired aesthetic in your prompt.

![Original](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-realistic.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)

![Oil Painting](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-oil-painting.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![Pencil Sketch](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-pencil-sketch.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![Pop Art](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-pop-art.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![Anime](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-anime.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)![Watercolor](https://docs.x.ai/_next/image?url=%2Fimages%2Fgeneration%2Fstyle-watercolor.webp&w=2048&q=75&dpl=aa8d204503f4c19e0d2003c8935a137a9eca60a3)

Original

Oil Painting

PythonBash

```
import xai_sdk

client = xai_sdk.Client()

response = client.image.sample(
    prompt="Render this image as an oil painting in the style of impressionism",
    model="grok-imagine-image-2.0",
    image_url="https://docs.x.ai/assets/api-examples/images/style-realistic.png",
)
print(response.url)
```

```
curl -X POST https://api.x.ai/v1/images/edits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "prompt": "Render this image as an oil painting in the style of impressionism",
    "model": "grok-imagine-image-2.0",
    "image": {"url": "https://docs.x.ai/assets/api-examples/images/style-realistic.png"}
  }'
```

Oil PaintingPencil SketchPop ArtAnimeWatercolor

* * *

## [Related](https://docs.x.ai/developers/model-capabilities/images/editing\#related)

- [Image Generation](https://docs.x.ai/developers/model-capabilities/images/generation) — Generate images from text prompts
- [Multi-Image Editing](https://docs.x.ai/developers/model-capabilities/images/multi-image-editing) — Edit with multiple source images
- [API Reference](https://docs.x.ai/developers/rest-api-reference) — Full endpoint documentation
- [Imagine API Landing Page](https://x.ai/api/imagine) — Showcase of the Imagine API in action

* * *

Last updated: August 13, 2026