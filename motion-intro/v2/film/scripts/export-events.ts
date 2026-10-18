import {buildEvents} from '../src/events';

process.stdout.write(JSON.stringify(buildEvents(), null, 1) + '\n');
