function swap(items, leftIndex, rightIndex){
  var temp = items[leftIndex];
  items[leftIndex] = items[rightIndex];
  items[rightIndex] = temp;
}

function partition(items, left, right) {
  var pivot   = items[Math.floor((right + left) / 2)];
  var i = left;
  var j = right;

  while (i <= j) {
    while (items[i] < pivot) {
      i++;
    }
    while (items[j] > pivot) {
      j--;
    }
    if (i <= j) {
      swap(items, i, j);
      i++;
      j--;
    }
  }
  return i;
}

function quick_sort_algo(items, left, right) {
  var index;
  if (items.length > 1) {
    index = partition(items, left, right);
    if (left < index - 1) {
      quick_sort_algo(items, left, index - 1);
    }
    if (index < right) {
      quick_sort_algo(items, index, right);
    }
  }
  return items;
}

module.exports.quick_sort = function(items) {
  return quick_sort_algo(items, 0, items.length - 1);
}
