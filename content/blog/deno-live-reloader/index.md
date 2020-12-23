---
title: Build a live reloader with Deno
date: "2020-10-28"
description: "A short introduction to Deno by building a live reloader similar to Nodemon and Wathcman. By going through the tutorial you will explore all principles of Deno."
---

*Before starting; if you don't know what Deno is and what it tries to accomplish, you should head over to this blog [post](https://deno.land/v1) if you want to learn more about it.*

![Deno Drawing](./deno.jpg)

Since **Deno** 1.0 was released, JS developers all around are interested in finding out what it has to offer and how it improves over **NodeJS**. To help, I wanted to build something simple and fun while exploring fundamentals of **Deno** runtime and tooling.

This is a small tutorial to build a bare bones live reloader like **nodemon** and **denon**. Keep in mind, we will not cover many edge cases and we will ignore possible bugs. Our reloader will also not have many of the features existing tools provide so you should probably keep on using **denon** for your Deno apps. But if you are interested in **Deno**, you can always improve upon what we have built here!

*The source code for this project is available on [Github](https://github.com/otanriverdi/denor).*

# Getting Started With Deno

Head over to the [manual](https://deno.land/manual/getting_started) to find out how to install **Deno** on your system and setup your development environment. Only suggestion I have about this is if you are using **vscode** and you installed the `deno-vscode` extension, you should change your global `settings.json` and add the `"deno.enable": false` option which is normally enabled by default. If you don't, all your JS/TS projects will be treated as a Deno project and you will need to turn that option off in every single NodeJS project. Because of this, you have to create a `.vscode` folder in each of your **Deno** projects and override that setting.

# Project Setup

Let's create the project directory and if you are using **vscode**, a `.vscode` directory inside it. We need a `settings.json` file inside this directory to set project based settings. We have to flag the project as a **Deno** project to enable the extension features because we have disabled them in the previous section.

```json
{
  "deno.enable": true
}
```

Deno supports both JavaScript and TypeScript as first class languages at runtime. Thanks to this, we will use TypeScript in this project with zero configuration. Our source code will be placed inside the `src` folder and as per convention, the entry point for our CLI tool will be placed inside the root directory. So create the `src` directory and the entry point file inside the root directory. For purposes of this tutorial, we are going to call it `denor.ts`. Later when we install the app with the `deno install` command, the name of the cli tool will be the same as the name of this file.

# Runtime API

First thing we need is a watcher to watch for file changes on our project directory. For this, we are going to use the runtime API. Deno tries to be as web compatible as possible, so it tries to use the existing web standards rather then creating new APIs. For everything that does not have a web standard, **Deno** has a global `Deno` namespace.

Let's create the `src/watcher.ts` file and start working on our watcher;

```typescript
export async function watchChanges(
  path: string,
  onChange: Function,
) {
  const watcher = Deno.watchFs(path);

  for await (const event of watcher) {
    if (event.kind === "modify") {
      onChange();
    }
  }
}
```

Let's explain what's going on here;

Our function takes a path to watch and a function to call on every file change. We create a watcher using the [Deno.watchFs()](https://doc.deno.land/https/github.com/denoland/deno/releases/latest/download/lib.deno.d.ts#Deno.watchFs) function of the Runtime API. The returned watcher is an `AsyncIterableIterator` that we can await for and iterate on every file change event inside the provided path. The watcher will keep watching on the directory until the `promise` rejects or stopped manually, otherwise it will never resolve and wait. We check if the `event` is of the kind `"modify"` and call our `onChange()` function if it is. Notice how we call our function synchronously without caring if it's asynchronous or not. The `Function` type accepts `async function` but we have to call it synchronously to not block the watcher. This is because our watcher is a for loop, which will not switch to a new event before the execution of the first event ends. This is not the behavior we want.

# Secure by Default

Deno is built to be secure by default so it will not have access to security sensitive areas unless the user specifically enables it with a command line flag. You can learn more about this [here](https://deno.land/manual/getting_started/permissions).

Let's now test our watcher inside our `denor.ts` file;

```typescript
import * as watcher from "./src/watcher.ts";

function main() {
  console.log("Watching for file changes.");

  await watcher.watchChanges(".", () => {
    console.log("File change detected.");
  })
}
main();
```

If you run your reloader with the command `deno run denor.ts` on your project directory, you will notice it will exit with an error because we didn't give deno access to read our file system. To fix this, we have to explicitly give deno permission to read, so change the command to `deno run --allow-read denor.ts`. If your CLI tool is now watching for changes, we did it! Make a small change in on of your project files and look at the output. You will notice our logs are not how we expect them to be. Our `console.log` gets called multiple times for every change. This is documented inside the documentation and we have to work around it.

> One user action (e.g. touch test.file) can generate multiple file system events.

We also might save multiple files at the same time in which case we don't want our callback function to get called multiple times.

So we have to update our watcher to wait for a small interval before every execution;

```typescript
export async function watchChanges(
  path: string,
  onChange: Function,
  config = { interval: 500 }
) {
  const watcher = Deno.watchFs(path);
  let reloading = false;

  for await (const event of watcher) {
    if (event.kind === "modify" && !reloading) {
      reloading = true;

      onChange();

      setTimeout(() => (reloading = false), config.interval);
    }
  }
}
```

We will wait for a small interval and block the watcher with a `reloading` variable. This variable will be configurable with the `config.interval` parameter and is `500ms` by default. So, the watcher will have to wait half a second to detect additional changes. Now, when you restart the app, you will notice the `console.log` will be called a single time for every change.

# Spawning a Subprocess

Now that our watcher is ready, we also need a runner to restart our process on every file change. For ease of use, we will take inspiration from **denon** and build our reloader to be a wrapper around the `deno` command. This means running `denor run` instead of `deno run` will have the same outcome with live reloading enabled.

So let's create the `src/runner.ts` file and build our runner;

```typescript
function denoRun(cmd: string[]) {
  return Deno.run({
    cmd: ["deno", ...cmd],
  });
}
```

We accept an array of strings and pass it to the [Deno.run()](https://doc.deno.land/https/github.com/denoland/deno/releases/latest/download/lib.deno.d.ts#Deno.run) function by adding the `deno` command before it. We will need the process later so we should return the process. We have to watch our process for any errors so that we can inform the user to make changes to fix them. Our error watcher function is;

```typescript
async function watchProcessError(
  process: Deno.Process,
  onError: Function
) {
  if ((await process.status()).success === false) {
    onError();
  }
}
```

This function will await for the process status and run the `onError()` callback in case of any errors. While the process is running, the `status()` promise will not resolve meaning we will keep watching on the status until it ends. The separate function to watch for the errors is needed because we need to call our error watcher synchronously. Again, this is because the error watcher waits for the execution to end and we don't want our watcher to be blocked with this.

Finally, we can combine these two functions into a single exported function which will be used inside the callback of the `watcher`.

```typescript
export function runAndWatchErrors(
  cmd: string[],
  onError: Function
) {
  const process = denoRun(Deno.args);

  watchProcessError(process, onError);

  return process;
}
```

But is this really enough? Let's think about this for a second. In our current setup, every time there is a file change, we will spawn a new subprocess. We have built our watcher to not wait for the execution end so what happens to our previous process when we spawn a new one? We have to make sure that it's closed before spawning the new process.

To do this, we modify our run function to close the existing process if there is one;

```typescript
function denoRun(cmd: string[], currentProcess?: Deno.Process) {
  if (currentProcess) {
    currentProcess.close();
  }

  return Deno.run({
    cmd: ["deno", ...cmd],
  });
}
```

But remember, we are also watching for the errors on the process and we are doing so synchronously. Because the process that the `watchProcessError` function is watching no longer exists, it will throw an error which will cause our live reloader to exit. To prevent this, we have to catch that error and simply ignore it;

```typescript
async function watchProcessError(
  process: Deno.Process,
  onError: Function
) {
  try {
    if ((await process.status()).success === false) {
      onError();
    }
  } catch (error) {
    return;
  }
}
```

We also need to modify our exported function to reflect these changes;

```typescript
export function runAndWatchErrors(
  cmd: string[],
  onError: Function,
  ongoingProcess?: Deno.Process
) {
  const process = denoRun(cmd, ongoingProcess);

  watchProcessError(process, onError);

  return process;
}
```

Now we are ready to tie everything together.

# Building Our CLI App

Let's modify the `main()` function inside the `denor.ts` file to use our `runner` inside the `watcher`;

```typescript
import * as watcher from "./src/watcher.ts";
import * as runner from "./src/runner.ts";

// error handler for the runner
function onError() {
  console.log("Error detected. Waiting for changes...");
}

async function main() {
  // initial process
  let process = runner.runAndWatchErrors(Deno.args, onError);

  console.log(
    "Running the process for the first time. Watching for changes..."
  );

  await watcher.watchChanges(".", async () => {
    console.log("Reloading the registered process...");

    // assign the new process and close the old one
    process = runner.runAndWatchErrors(Deno.args, onError, process);

    // give the app some time to build/fail
    setTimeout(() => console.log("Watching for changes..."), 2500);
  });
}
main();
```

Here, we are running the command for the first time and assign the process into a variable to be able close it when reloading. Every time there is a file change, we close the old process and update the process variable with the returned process from the `runAndWatchErrors()` function. We receive CLI arguments with the [Deno.args](https://doc.deno.land/https/github.com/denoland/deno/releases/latest/download/lib.deno.d.ts#Deno.args) variable.

> Returns the script arguments to the program. If for example we run a program:
> `deno run --allow-read https://deno.land/std/examples/cat.ts /etc/passwd`
> Then Deno.args will contain:
> `"/etc/passwd"`

To test if the core functionality of our reloader works, let's create a `test.ts` file inside the root directory and fill it with some basic code. This is the `test.ts` file that I will be using;

```typescript
console.log("My app is running...");

setTimeout(() => {
  throw new Error("My app has thrown an error!");
}, 10000);
```

We can test our reloader using this command: `deno run --allow-read --allow-run denor.ts run test.ts`. We need the `--allow-run` flag since we need to spawn a subprocess. When our reloader is installed on our system, this command will be replaced with `denor run test.ts` which is more intuitive. Try to make some changes on `test.ts` and see if the process reloads. If you reload the app before it throws the error, wait for sometime to see if  the error is thrown for a single time. If you see multiple errors, there probably is an error in your code and our reloader does not close the process properly. If everything is running smoothly and your app is reloading correctly, good job! We made it! Now it's time to make it more beautiful and explore more features of **Deno** in the process.

# Using the Standard Library and Third-Party Libraries

We will be using the standard library to add some color to our terminal output and with this, we will explore how to import external code to our **Deno** apps. Importing third-party libraries works the exact same way so the information carries over. Very much like a browser, **Deno** imports external code with URLs and it caches remote imports in a special directory specified by the `$DENO_DIR` environment variable. This means, no more `node_modules` and `package.json`. You can read more about how this works [here](https://deno.land/manual/linking_to_external_code).

By now, you must be thinking: "If I have to update a dependency, do I have to update every single link?" or "How will I track my dependencies, should I check each module to see what I imported ?". The answer is no. By convention, external **Deno** dependencies are placed inside a file called `deps.ts` inside the root directory and re-exported. This way, they can be managed from a single source very much like `package.json`.

For our reloader, we will import some functions from `fmt/colors` module of the **Deno** standard library. Here is our `deps.ts` file;

```typescript
export {
  red,
  green,
  bold,
  yellow,
  magenta,
  underline,
} from "https://deno.land/std/fmt/colors.ts";
```

**Standard libraries are updated alongside Deno so you have to specify which version you are importing otherwise Deno will use the latest branch. For the purposes of this guide, I will just import the latest branch which you should normally avoid. You can learn more about this [here](https://deno.land/std).**

Now let's create our logger! Create the file `src/logger.ts` and add these functions;

```typescript
import { red, green, bold, yellow, magenta, underline } from "../deps.ts";

export function update(text: string) {
  console.log(magenta(bold(underline(text))));
}

export function fail(text: string) {
  console.log(red(bold(underline(text))));
}

export function load(text: string) {
  console.log(yellow(bold(underline(text))));
}

export function success(text: string) {
  console.log(green(bold(underline(text))));
}
```

Very much like `nodemon`, we want our reloader to log which file has changed before reloading. So inside the `src/watcher.ts`, modify your watcher function to log which file has changed;

```typescript
import * as logger from "./logger.ts";

export async function watchChanges(
  path: string,
  onChange: Function,
  config = { interval: 500 }
) {
  const watcher = Deno.watchFs(path);
  let reloading = false;

  for await (const event of watcher) {
    if (event.kind === "modify" && !reloading) {
      logger.update(`Detected a change on ${event.paths[0]}`);

      reloading = true;

      onChange();

      setTimeout(() => (reloading = false), config.interval);
    }
  }
}
```

Finally, we need to replace the `console.log` calls inside the main entry point file which is `denor.ts` in my case;

```typescript
import * as watcher from "./src/watcher.ts";
import * as runner from "./src/runner.ts";
import * as logger from "./src/logger.ts";

// error handler for the runner
function onError() {
  logger.fail("Error detected. Waiting for changes...");
}

async function main() {
  // initial process
  let process = runner.runAndWatchErrors(Deno.args, onError);
  logger.success(
    "Running the process for the first time. Watching for changes..."
  );

  await watcher.watchChanges(".", async () => {
    logger.load("Reloading the registered process...");

    // assign the new process
    process = runner.runAndWatchErrors(Deno.args, onError, process);

    // give the app some time to build/fail
    setTimeout(() => logger.success("Watching for changes..."), 2500);
  });
}
main();
```

# Deno Tooling

Like **Go**, **Deno** provides some built in tooling that will be useful when developing your applications. In my opinion, this is an huge improvement over **NodeJS** because it eases the JavaScript fatigue by setting a standard on these tools and also removing the configuration step which is a huge (but admittedly fun) pain. You can find a list of all the tools available [here](https://deno.land/manual/tools). We can explore some of them in our project.

For starters, let's format our code with the deno formatter by using the command `deno fmt` inside our project directory. In JavaScript, code formatting is a huge discussion topic where everyone has their own very strong opinion on how our code should be formatted. With `deno fmt`, **Deno** sets a universal standard. Imagine every code you ever work with is formatted the same and you no longer loose time thinking over what is the best way to format your code. It has it's limitations but it's more productive in the long run.

Now, we are ready to install our live reloader and test it. Run the command `deno install --allow-read --allow-run denor.ts`. If you didn't add deno path to your $PATH, the terminal will warn you that you should do so. If that's okay, your live reloader should be now available as `denor` or what ever name you have given to your main entry point file.

On any deno project (or inside your live reloader project), you can run the command `denor run *filename*` which will start your live reloader.

## That's It!

I hope you liked this guide and now have an understanding and opinion about basics of **Deno**. Although it has a long road in front of it, I believe **Deno** has a great future and I am excited to see what it will mean for the JS ecosystem in the long run. If you want to hear more from me, feel free to follow me on Twitter from the banner below!
