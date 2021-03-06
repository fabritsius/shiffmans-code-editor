let editor;
let turtle;
let turtled_image;
let user_methods;

/**
 * p5 setup() function (we changing it, not creating)
 */
setup = () => {
  turtled_image = createCanvas(400, 400).parent('logo');
  angleMode(DEGREES);
  background(0);
  turtle = new Turtle(width/2, height/2, 0);
  editor = select('#code');
  // load a random example from ./examples
  getRandomExample().then((example) => {
    editor.value(example);
    goTurtle();
  });
  // redraw each time code changes
  editor.input(goTurtle);
  // setup 'file save' button and Ctrl+S
  save_btn = select('#save_file_btn');
  save_btn.mousePressed(saveCode);
  document.addEventListener('keypress', (event) => {
    if (event.ctrlKey && event.code === 'KeyS') {
      event.preventDefault();
      saveCode();
    }
  });
  // setup drag'n'drop for .logocode files
  addFileDragDrop();
  // handle Tab presses in the editor
  handleTab();
  // adapt canvas to the screen size on setup and future resizes
  scaleCanvas();
  window.addEventListener('resize', () => {
    scaleCanvas();
  });
  // load docs
  loadDocumentation();
}

/**
 * goTurtle() initiates the turtle movement.
 */
const goTurtle = () => {
  background(0);
  push();
  
  turtle.reset();
  const code = editor.value();
  // convert code into an array of tokens
  const tokens = parseCode(code);
  user_methods = {};
  // recursively draw the path from tokens
  reTurtle(tokens);
  
  pop();
}

/**
 * reTurtle(tokens [, start, until_end]) gives a command to a turtle.
 * Returns an index at which this instanse of the function finished.
 * Arguments:
 *   'start' argument sets starting position;
 *   'until_end' argument allows to stop execution if 'end' keyword encountered.
 */
const reTurtle = (tokens, start = 0, until_end = false) => {
  let index = start;
  let not_executing = false;
  while (index < tokens.length) {
    let token = tokens[index];
    // handle 'end' keyword
    if (token === 'end') {
      if (until_end) return;
      // start executing again
      not_executing = false;
    // skip this token if not execution at the moment
    } else if (not_executing) {
      index++;
      continue;
    // handle user methods definition
    } else if (token === 'to') {
      // stop executing intil method definition ends
      not_executing = true;
      if (index + 2 < tokens.length) {
        // store token in user_methods
        token = tokens[++index]
        if (!commands[token]) {
          user_methods[token] = index + 1;
        }
      }
    // handle 'save' keyword
    } else if (token === 'save') {
      const file_name = 'turtled_image';
      saveCanvas(turtled_image, file_name, 'png');
    // handle 'bckgr' which is used to change background
    } else if (token === 'bckgr') {
      if (tokens[index + 1]) {
        const color = tokens[++index];
        background(color);
      }
    // handle 'repeat' (loop) keyword
    } else if (token === 'repeat') {
      const times = parseInt(tokens[++index]);
      if (tokens[index + 1] && tokens[index + 1] === '[') {
        const repeat_start = ++index;
        for (let i = 0; i < times; i++) {
          // start another reTurtle for every (inner) loop
          index = reTurtle(tokens, repeat_start, true);
        }
      }
    // handle user defined methods
    } else if (token in user_methods) {
      // launch reTurtle
      // ... from the position stored in user_methods
      // ... and until first 'end' keyword
      reTurtle(tokens, user_methods[token], true);
    // handle turtle commands
    } else if (index < tokens.length) {
      // check if this is the end of the loop (repeat)
      if (token === ']') {
        return index;
      } else {
        try {
          handleCommand(token, index, tokens);
        } catch {
          continue;
        }
      }
    }
    index++;
  }
}

/**
 * handleCommand(token, index, tokens)
 * 1. analyzes a token;
 * 2. gives turtle a command.
 */
const handleCommand = (token, index, tokens) => {
  if (token in commands) {
    if (token.charAt(0) === 'p') {
      // give command to a turtle
      commands[token]();
    } else {
      // check if aguments might be in array
      if (index + 1 < tokens.length) {
        arg = tokens[index + 1];
        // give command to a turtle
        commands[token](arg);
      }
    }
  }
}

/**
 * getRandomExample() fetches random code example.
 * Returns code string as a promise. 
 */
const getRandomExample = () => { 
  const user = 'fabritsius';
  const repo = 'logo-code-editor';
  const base_uri = `https://api.github.com/repos/${user}/${repo}/contents`;
  // get a list of examples (returns a promise)
  return fetch(`${base_uri}/examples`).then((response) => {
    return response.json();
  }).then((files) => {
    let attempts = 0;
    let random_example;
    // try 10 times to get an index which isn't a README file
    while (!random_example && attempts < 10) {
      const random_idx = int(random(files.length));
      // pick this example if it has proper extension
      if (files[random_idx].name.endsWith('.logocode')) {
        random_example = files[random_idx];
      }
      attempts++;
    } 
    // get content of a randomly chosen example (returns a promise)
    return fetch(random_example.url).then((response) => {
      return response.json();
    }).then((file) => {
      // display the name of the example
      const example_name = document.querySelector('#example_name');
      const file_name = file.name.replace(/_/g, ' ').slice(0, -9);
      example_name.innerHTML = file_name;
      // remove example after 2 seconds
      setTimeout(() => {
        example_name.classList.add("is_hidden");
      }, 2000);
      // return converted (from base64) content
      return atob(file.content);
    });
  });
}

/**
 * addFileDragDrop()
 * Adds eventListeners for Drag'n'Drop Handling
 */
const addFileDragDrop = () => {
  drop_zone = document.querySelector('#code');
  // use p5 to handle drop event
  editor.drop((file) => {
    if (file.name.endsWith('.logocode')) {
      // separate content encoded as base64
      const content = file.data.split(',')[1];
      // give a border color feedback
      if (file.data && content) {
        styleFeedback(drop_zone, 'correct_file_dropped', 200);
        // decode and update the editor textarea
        editor.value(atob(content));
        goTurtle();
      } else {
        styleFeedback(drop_zone, 'wrong_file_dropped', 200);
      }
    } else {
      styleFeedback(drop_zone, 'wrong_file_dropped', 200);
    }
  });
  // use plain JS to handle drag'n'drop animation
  // change coloring based on wheather a file is in the dropzone
  document.addEventListener('dragenter', (event) => {
    if (event.target.id === 'code') {
      drop_zone.classList.add('file_hovered');
      drop_zone.classList.remove('file_dragged');
    } else {
      drop_zone.classList.add('file_dragged');
      drop_zone.classList.remove('file_hovered');
    }
  });
  // remove coloring if file is off screen
  document.addEventListener('dragleave', (event) => {
    if (event.pageX === 0 && event.pageY === 0) {
      drop_zone.classList.remove('file_dragged');
    }
  });
  // remove coloring after file drop
  drop_zone.addEventListener('drop', (event) => {
    drop_zone.classList.remove('file_hovered');
    drop_zone.classList.remove('file_dragged');
  });
}

/**
 * styleFeedback(element, switch_class, period_ms)
 * Switches a class of an element for a period in milliseconds.
 */
const styleFeedback = (element, switch_class, period_ms) => {
  element.classList.add(switch_class);
  setTimeout(() => {
    drop_zone.classList.remove(switch_class);
  }, period_ms);
}

/**
 * handleTab()
 * Tab won't cause a jump to the next DOM element.
 */
const handleTab = () => {
  const code_area = document.querySelector('#code');
  code_area.onkeydown = (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const cursor = code_area.selectionEnd;
      const before_text = code_area.value.slice(0, code_area.selectionStart);
      const after_text = code_area.value.slice(cursor);
      code_area.value = `${before_text}  ${after_text}`;
      code_area.selectionStart = cursor + 2;
      code_area.selectionEnd = cursor + 2;
    }
  }
}

/**
 * loadDocumentation()
 * Load documentation which now can be viewed under the editor.
 */
const loadDocumentation = () => {
  const repo = 'logo-code-editor';
  // fetch and parse documentation from /docs URI
  const documentation = document.querySelector('#documentation');
  fetch(`/${repo}/docs/index.html`).then((response) => {
    return response.text();
  }).then((docs_unparsed) => {
    const parser = new DOMParser();
    const docs = parser.parseFromString(docs_unparsed, "text/html");
    documentation.appendChild(docs.querySelector('#documentation_content'));
  });
  // setup documentation toggle events
  const docs_btn = document.querySelector('#docs_btn');
  docs_btn.addEventListener('click', () => {
    documentation.classList.toggle('is_hidden');
    docs_btn.classList.toggle('active');
    if (docs_btn.classList.contains('active')) {
      docs_btn.innerHTML = 'hide docs'
    } else {
      docs_btn.innerHTML = 'show docs'
    }
  });
}

/**
 * parseCode(input_string)
 * Returns an array of tokens splitting by spaves, new lines and brackets
 * Similar to string.split() but preserves brackets as tokens. 
 */
const parseCode = (input_string) => {
  tokens = [];
  word = '';
  for (let letter of input_string) {
    if (letter === ' ' || letter === '\n') {
      if (word) {
        tokens.push(word);
        word = '';
      }
    } else if (letter === '[' || letter === ']') {
      if (word) {
        tokens.push(word);
        word = '';
      }
      tokens.push(letter);
    } else {
      word += letter;
    }
  }
  if (word) tokens.push(word);
  return tokens;
}

/**
 * saveCode()
 * Saves code from the editor as a .logocode file.
 */
const saveCode = () => {
  saveStrings(editor.value().split('\n'),
    'turtle_path', 'logocode');
}

/**
 * scaleCanvas()
 * This function ensures the canvas fits into it's parent.
 */
const scaleCanvas = () => {
  const canvas = document.querySelector('#logo canvas');
  const parentWidth = canvas.parentElement.offsetWidth;
  if (windowWidth < 500 && canvas.width > parentWidth) {
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${parentWidth}px`;
  }
}