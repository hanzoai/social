# Hanzo Social NodeJS SDK

This is the NodeJS SDK for [Hanzo Social](https://social.com).

You can start by installing the package:

```bash
npm install @social/node
```

## Usage
```typescript
import Hanzo Social from '@social/node';
const social = new Hanzo Social('your api key', 'your self-hosted instance (optional)');
```

The available methods are:
- `post(posts: CreatePostDto)` - Schedule a post to Hanzo Social
- `postList(filters: GetPostsDto)` - Get a list of posts
- `upload(file: Buffer, extension: string)` - Upload a file to Hanzo Social
- `integrations()` - Get a list of connected channels
- `deletePost(id: string)` - Delete a post by ID

Alternatively you can use the SDK with curl, check the [Hanzo Social API documentation](https://docs.social.com/public-api) for more information.