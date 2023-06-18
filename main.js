function addZeroPadding(num) {
  return num.toString().padStart(2, '0');
}

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

window.mainBlock = false;

async function main() {
  const detailsDiv = document.getElementById('details'),
        progress = document.createElement('div'),
        progressText = document.createElement('h3');

  window.mainBlock = true;

  //window.courseInfo = [];
  progress.className = 'loading_screen';

  // loading circle
  progress.insertAdjacentHTML('beforeend', '<div class="loader"></div>');

  progress.appendChild(progressText);
  detailsDiv.appendChild(progress);

  console.log('Fetching course list...');
  progressText.innerHTML = 'Loading... Please wait<br />(1/3: Fetching course list)';

  const coursesResponse = await gapi.client.classroom.courses.list(),
        courses = coursesResponse.result.courses.filter(c => c.courseState != 'ARCHIVED'); // ignore archived courses to save API quota

  console.log('Fetching homework list...');
  progressText.innerHTML = 'Loading... Please wait<br />(2/3: Fetching homework list)';

  const coursesWorkBatch = gapi.client.newBatch();

  courses.forEach(c => {
    c.courseWork_request_id = coursesWorkBatch.add(gapi.client.classroom.courses.courseWork.list({ courseId: c.id }));
  });

  await coursesWorkBatch.then(batchResponse => {
    for (const [id, response] of Object.entries(batchResponse.result)) {
      const course = courses.filter(c => c.courseWork_request_id === id)[0];
      course.courseWork = JSON.parse(response.body).courseWork;
    }
  })

  console.log('Fetching homework details...');
  progressText.innerHTML = 'Loading... Please wait<br />(3/3: Fetching homework details)';

  const courses_and_hw = await Promise.all(courses.map(async course => {
    const courseWork = course.courseWork;

    if (courseWork) {
      const submissionsBatch = gapi.client.newBatch();

      // sort homework by submission date
      courseWork.sort((a, b) => {
        let a_date, b_date;

        if (window.sortWithCreationDate) {
          a_date = new Date(a.creationTime);
          b_date = new Date(b.creationTime);
        } else {
          a_date = new Date(a.dueDate?.year || 9999, a.dueDate?.month || 12, a.dueDate?.day || 31);
          b_date = new Date(b.dueDate?.year || 9999, b.dueDate?.month || 12, b.dueDate?.day || 31);
        }

        return (a_date - b_date);
      });

      courseWork.forEach(hw => {
        // get submission states of each homework
        const params = { courseWorkId: hw.id, courseId: hw.courseId };
        hw.submission_request_id = submissionsBatch.add(gapi.client.classroom.courses.courseWork.studentSubmissions.list(params));
      });

      await submissionsBatch.then(batchResponse => {
        for (const [id, response] of Object.entries(batchResponse.result)) {
          const hw = courseWork.filter(hw => hw.submission_request_id === id)[0];
          hw.submission = JSON.parse(response.body).studentSubmissions[0];
        }
      });
    }

    return {courseObj: course, hwArray: courseWork};
  }));

  detailsDiv.removeChild(progress);

  const sortOptionDiv      = document.createElement('div'),
        sortOptionCheckbox = { label: document.createElement('label'), span: document.createElement('span'), input: document.createElement('input') };

  sortOptionCheckbox.label.className  = 'switch';
  sortOptionCheckbox.input.type       = 'checkbox';
  sortOptionCheckbox.span.className   = 'slider round';

  sortOptionDiv.className = 'horizontal_flex';
  sortOptionDiv.appendChild(document.createTextNode('按截止日期排序'));

  sortOptionCheckbox.input.checked = window.sortWithCreationDate;

  sortOptionCheckbox.input.addEventListener('click', async () => {
    window.sortWithCreationDate = sortOptionCheckbox.input.checked;
    detailsDiv.innerHTML = '';
    console.log(detailsDiv);
    await new Promise((resolve, _) => setTimeout(() => { if (!window.mainBlock) resolve(); }, 200));
    main();
  });

  console.log(sortOptionCheckbox);

  sortOptionCheckbox.label.appendChild(sortOptionCheckbox.input);
  sortOptionCheckbox.label.appendChild(sortOptionCheckbox.span);

  sortOptionDiv.appendChild(sortOptionCheckbox.label);
  sortOptionDiv.appendChild(document.createTextNode('按創建日期排序'));

  detailsDiv.appendChild(sortOptionDiv)

  courses_and_hw.forEach(course => {
    const entry = document.createElement('details');

    if (!course.hwArray) {
      entry.insertAdjacentHTML('beforeend', '<p>呢個課程暫時未有任何功課</p>');
      return;
    }

    //courseInfo.push(course.hwArray);

    const hwStatistics   = getCompletedPercentage(course.hwArray),
          statisticsDiv  = document.createElement('div'),
          summaryElement = document.createElement('summary'),
          hwProgressBar  = createHWProgressBar(hwStatistics.percentage);

    summaryElement.className = 'course';
    statisticsDiv.className  = 'statistics';
    statisticsDiv.appendChild(hwProgressBar);
    statisticsDiv.insertAdjacentHTML('beforeend', `<p style='min-width: 45px;'>${hwStatistics.completed}/${hwStatistics.total}</p>`);

    summaryElement.insertAdjacentHTML('beforeend', `<img class='ico' src='/img/down_arrow.svg' /><p>${course.courseObj.name}</p>`);
    summaryElement.appendChild(statisticsDiv);

    entry.appendChild(summaryElement);

    for (hw of course.hwArray) {
      const hwEntry         = document.createElement('details'),
            hwInfo          = document.createElement('div'),
            hwInfoContainer = document.createElement('div'),
            summary         = document.createElement('summary'),
            hwStatus        = getHWStatus(hw),
            badge           = generateHWStatusBadge(hwStatus);

      hwInfo.appendChild(hwInfoContainer);
      hwEntry.appendChild(hwInfo);

      hwEntry.className = 'hwEntry';
      hwInfo.className  = 'hwInfo';

      console.log('Parsing homework: ', hw);
      summary.insertAdjacentHTML('beforeend', `<img class='ico' src='/img/down_arrow.svg' /><p>${hw.title}</p>`);

      summary.appendChild(badge);
      hwEntry.appendChild(summary);

      hwInfoContainer.insertAdjacentHTML('beforeend', `
        <h2>${hw.title}</h2>
        <a href='${hw.alternateLink}'>於 Google Classroom 查看詳情</a>
        <p>詳情: </p><pre class='hwDesc'><code>${hw.description || '（冇打）'}</code></pre>
        <p>喺 ${new Date(Date.parse(hw.creationTime)).toLocaleString()} 佈置</p>
      `);

      if (hw.materials) hwInfoContainer.insertAdjacentHTML('beforeend', `<p>有 ${hw.materials.length} 個附件</p>`);

      if (hw.dueDate) {
        hwInfoContainer.insertAdjacentHTML('beforeend', '<p>Deadline 喺 ' +
        `${hw.dueDate.year} 年 ` +
        `${hw.dueDate.month} 月 ` +
        `${hw.dueDate.day} 號 ` +
        `${addZeroPadding(hw.dueTime.hours || 0)} 點 ` +
        `${addZeroPadding(hw.dueTime.minutes || 0)} 分</p>`);
      }

      hwEntry.insertAdjacentHTML('beforeend', '<hr />');
      entry.appendChild(hwEntry);
    }

    detailsDiv.appendChild(entry);
    detailsDiv.insertAdjacentHTML('beforeend', '<hr />');
  });

  window.mainBlock = false;
}

(new Promise((resolve, _) => window.resolveGoogleLoginPromise = resolve)).then(() => main());