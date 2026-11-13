# Your own meme videos (optional)

The game already has 38 meme clips of its own. You can add real video files too: they show up
in the meme app on your phone, mixed in with the built-in ones.

1. Put the video files in this folder (`assets/videos/`). Use `.mp4` (best on every phone), short
   clips (under 30 seconds) and small files (a few MB each).
   File names: letters, numbers, spaces, `-`, `_`, `.` and `( )` only.
2. List them in `list.json`, in this folder:

```json
[
  { "file": "cat-falls.mp4", "title": "he tried his best", "from": "@my.cat" },
  { "file": "my-friend-trips.mp4", "title": "every single time" },
  "just-a-file-name.mp4"
]
```

3. Commit and push. Vercel puts the new version online by itself.

Only add videos you made yourself, or videos you are allowed to share: everything in this folder
is public on your site. Your own videos only play in your own phone's meme app; the videos in the
story missions and the ones classmates show you are always the built-in clips.
