# Nano Banana

> Google's famous original image generation and editing model


## Overview

- **Endpoint**: `https://fal.run/fal-ai/nano-banana`
- **Model ID**: `fal-ai/nano-banana`
- **Category**: text-to-image
- **Kind**: inference
**Tags**: image-generation



## Pricing

Your request will cost **$0.039** per image. For **$1.00**, you can run this model **25 times.**

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_):
  The text prompt to generate an image from.
  - Examples: "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."

- **`num_images`** (`integer`, _optional_):
  The number of images to generate. Default value: `1`
  - Default: `1`
  - Range: `1` to `4`

- **`seed`** (`integer`, _optional_):
  The seed for the random number generator.

- **`aspect_ratio`** (`AspectRatioEnum`, _optional_):
  The aspect ratio of the generated image. Default value: `"1:1"`
  - Default: `"1:1"`
  - Options: `"21:9"`, `"16:9"`, `"3:2"`, `"4:3"`, `"5:4"`, `"1:1"`, `"4:5"`, `"3:4"`, `"2:3"`, `"9:16"`

- **`output_format`** (`OutputFormatEnum`, _optional_):
  The format of the generated image. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`

- **`safety_tolerance`** (`SafetyToleranceEnum`, _optional_):
  The safety tolerance level for content moderation. 1 is the most strict (blocks most content), 6 is the least strict. Default value: `"4"`
  - Default: `"4"`
  - Options: `"1"`, `"2"`, `"3"`, `"4"`, `"5"`, `"6"`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`limit_generations`** (`boolean`, _optional_):
  Experimental parameter to limit the number of generations from each round of prompting to 1. Set to `True` to to disregard any instructions in the prompt regarding the number of images to generate. Default value: `true`
  - Default: `true`



**Required Parameters Example**:

```json
{
  "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."
}
```

**Full Example**:

```json
{
  "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
  "num_images": 1,
  "aspect_ratio": "1:1",
  "output_format": "png",
  "safety_tolerance": "4",
  "limit_generations": true
}
```


### Output Schema

The API returns the following output format:

- **`images`** (`list<ImageFile>`, _required_):
  The generated images.
  - Array of ImageFile
  - Examples: [{"url":"https://storage.googleapis.com/falserverless/example_outputs/nano-banana-t2i-output.png","file_name":"nano-banana-t2i-output.png","content_type":"image/png"}]

- **`description`** (`string`, _required_):
  The description of the generated images.



**Example Response**:

```json
{
  "images": [
    {
      "url": "https://storage.googleapis.com/falserverless/example_outputs/nano-banana-t2i-output.png",
      "file_name": "nano-banana-t2i-output.png",
      "content_type": "image/png"
    }
  ],
  "description": ""
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/nano-banana \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/nano-banana",
    arguments={
        "prompt": "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/nano-banana", {
  input: {
    prompt: "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/nano-banana)
- [API Documentation](https://fal.ai/models/fal-ai/nano-banana/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/nano-banana)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`
