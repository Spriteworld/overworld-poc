
function random_rgba() {
  return '0x' + Math.floor(Math.random() * 16777215).toString(16);
}

export { random_rgba };
