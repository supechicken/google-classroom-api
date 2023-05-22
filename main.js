function createHWProgressBar(percentage) {
  const progressBar = document.createElement('div'),
        completedBar = document.createElement('div');

  progressBar.className = 'hwProgressBar';
  progressBar.appendChild(completedBar);

  completedBar.style.width = `${percentage}%`;

  if (percentage < 50) {
    completedBar.style.backgroundColor = 'var(--red)';
  } else if (percentage < 80) {
    completedBar.style.backgroundColor = 'var(--yellow)';
  } else {
    completedBar.style.backgroundColor = 'var(--green)';
  }

  return progressBar;
}

function getHWStatus(hw) {
  if (hw.submission.state == 'TURNED_IN' && hw.submission.late) {
    return 'done_late';
  } else if (hw.submission.state == 'TURNED_IN') {
    return 'done';
  } else if (hw.submission.late) {
    return 'missing';
  } else {
    return 'assigned';
  }
}

function getCompletedPercentage(hwArray) {
  const total = hwArray.length;
  let completed = 0;

  hwArray.forEach(hw => {
    const status = getHWStatus(hw);
    if (status == 'done' || status == 'done_late') completed++;
  });

  const percentage = (completed / total) * 100;
  return {percentage: percentage, completed: completed, total: total};
}

function generateHWStatusBadge(status) {
  const badge = document.createElement('p');
  badge.className = 'hwStatusBadge';

  switch (status) {
    case 'done':
      badge.style.backgroundColor = 'var(--green)';
      badge.innerText = '已完成';
      break;
    case 'done_late':
      badge.style.backgroundColor = 'var(--gray)';
      badge.innerText = '已完成 (遲交)';
      break;
    case 'missing':
      badge.style.backgroundColor = 'var(--red)';
      badge.innerText = '欠交';
      break;
    case 'assigned':
      badge.style.backgroundColor = 'var(--green)';
      badge.innerText = '已指派';
      break;
  }

  return badge;
}