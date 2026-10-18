import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
// platform delivery: limited-range BT.709, fully tagged (a player that ignores a full-range flag would crush the navy)
Config.setColorSpace('bt709');
Config.setPixelFormat('yuv420p');
