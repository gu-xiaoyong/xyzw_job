import { isInCurrentWeek, sleep } from "@/utils/base";
import { gameLogger } from "@/utils/logger";
import { findAnswer } from "@/utils/studyQuestionsFromJSON";
import type { EVM, XyzwSession } from ".";

export const StudyPlugin = ({
  onSome,
  $emit
}: EVM) => {
  onSome(['study', 'studyresp', 'study_startgame', 'study_startgameresp'], async (data: XyzwSession) => {
    gameLogger.verbose(`收到学习答题事件: ${data.tokenId}`, data);
    const { body, gameData, client } = data;
    if (!body) {
      return;
    }

    gameLogger.info('开始处理学习答题响应')
    // 获取题目列表和学习ID
    const questionList = body.questionList
    const studyId = body.role?.study?.id

    if (!questionList || !Array.isArray(questionList)) {
      gameLogger.error('未找到题目列表')
      return
    }

    // 服务器未下发题目：本周已答满10题并领过奖励，无需重复答题
    if (questionList.length === 0) {
      gameLogger.info('服务器未返回题目，本周已答完并领过奖励，跳过答题和领奖')
      gameData.value.studyStatus = {
        ...gameData.value.studyStatus,
        isAnswering: false,
        questionCount: 0,
        answeredCount: 0,
        status: 'completed',
        timestamp: Date.now(),
        thisWeek: true,
        isCompleted: true
      }
      // 稍作停留让批量任务轮询到完成状态，再复位
      await sleep(1500)
      gameData.value.studyStatus = {
        isAnswering: false,
        questionCount: 0,
        answeredCount: 0,
        status: '',
        timestamp: null,
        baseCorrect: null,
        correctCount: null,
        wrongCount: null
      }
      return
    }

    if (!studyId) {
      gameLogger.error('未找到学习ID')
      return
    }
    gameLogger.info(`找到 ${questionList.length} 道题目，学习ID: ${studyId}`)
    // 更新答题状态（baseCorrect: 本轮开始时的本周累计答对数，用于结算答对/答错题数）
    gameData.value.studyStatus = {
      isAnswering: true,
      questionCount: questionList.length,
      answeredCount: 0,
      status: 'answering',
      timestamp: Date.now(),
      baseCorrect: Number(body.role?.study?.maxCorrectNum ?? 0),
      correctCount: null,
      wrongCount: null
    }
    try {
      // 遍历题目并回答
      for (let i = 0; i < questionList.length; i++) {
        const question = questionList[i]
        const questionText = question.question
        const questionId = question.id

        gameLogger.debug(`题目 ${i + 1}: ${questionText.substring(0, 20)}...`)

        // 查找答案（异步）
        let answer = await findAnswer(questionText)

        if (answer === null) {
          answer = 1
          gameLogger.debug(`题库未命中，使用默认答案: ${answer}，题目: ${questionText}`)
        } else {
          gameLogger.debug(`找到答案: ${answer}`)
        }

        // 发送答案
        try {
          client?.send('study_answer', {
            id: studyId,
            option: [answer],
            questionId: [questionId]
          })
          gameLogger.verbose(`已提交题目 ${i + 1} 的答案: ${answer}`)
        } catch (error) {
          gameLogger.error(`提交答案失败 (题目 ${i + 1}):`, error)
        }

        // 更新已回答题目数量
        gameData.value.studyStatus.answeredCount = i + 1

        // 添加短暂延迟，避免请求过快
        if (i < questionList.length - 1) {
          await sleep(300)
        }
      }
      // 延迟1500ms后领取奖励
      await sleep(1500)
      $emit.emit('I-study-week-forward', data)
    } catch (error) {
      gameLogger.error('处理学习答题响应失败:', error)
    }
  });
  //
  onSome(['I-study'], (data: XyzwSession) => {
    const { body, gameData } = data;
    const maxCorrectNum = body.role.study.maxCorrectNum
    const beginTime = body.role.study.beginTime
    const isStudyCompleted = maxCorrectNum >= 10 && isInCurrentWeek(beginTime * 1000)

    // 更新答题完成状态
    if (!gameData.value.studyStatus) {
      gameData.value.studyStatus = {}
    }
    gameData.value.studyStatus.thisWeek = isStudyCompleted
    gameData.value.studyStatus.isCompleted = isStudyCompleted
    gameData.value.studyStatus.maxCorrectNum = maxCorrectNum

    gameLogger.info(`答题状态更新: maxCorrectNum=${maxCorrectNum}, 完成状态=${isStudyCompleted}`)
  });
  // 
  onSome(['I-study-week-forward'], async (data: XyzwSession) => {
    gameLogger.info('开始领取答题奖励')
    const { gameData, client } = data;
    // 更新状态为正在领取奖励
    gameData.value.studyStatus.status = 'claiming_rewards'
    // 领取所有等级的奖励 (1-10)
    for (let rewardId = 1; rewardId <= 10; rewardId++) {
      try {
        client?.send('study_claimreward', {
          rewardId: rewardId
        })
        await new Promise(resolve => setTimeout(resolve, 200))
        gameLogger.verbose(`已发送奖励领取请求: rewardId=${rewardId}`)
      } catch (error) {
        gameLogger.error(`发送奖励领取请求失败 (rewardId=${rewardId}):`, error)
      }
    }

    gameLogger.info('一键答题完成！已尝试领取所有奖励')

    // 结算答题结果：maxCorrectNum 为本周累计答对题数，与开始时差值即本轮答对数
    try {
      const res: any = await client?.sendWithPromise('role_getroleinfo', {}, 8000)
      const after = Number(res?.role?.study?.maxCorrectNum)
      const base = Number(gameData.value.studyStatus.baseCorrect ?? 0)
      const total = Number(gameData.value.studyStatus.questionCount ?? 0)
      if (!Number.isNaN(after)) {
        const correct = Math.min(Math.max(after - base, 0), total > 0 ? total : Math.max(after - base, 0))
        const wrong = Math.max(total - correct, 0)
        gameData.value.studyStatus.correctCount = correct
        gameData.value.studyStatus.wrongCount = wrong
        gameLogger.info(`答题结果: 共${total}题, 答对${correct}题, 答错${wrong}题 (本周累计答对${after}/10)`)
      }
    } catch (error) {
      gameLogger.warn('查询答题结果失败:', error)
    }

    // 更新状态为完成
    gameData.value.studyStatus.status = 'completed'

    // 3秒后重置状态
    await new Promise(resolve => setTimeout(resolve, 1000))
    gameData.value.studyStatus = {
      isAnswering: false,
      questionCount: 0,
      answeredCount: 0,
      status: '',
      timestamp: null,
      baseCorrect: null,
      correctCount: null,
      wrongCount: null,
      source: null
    }

    // 1秒后更新游戏数据
    try {
      // client?.send('role_getroleinfo', {})
      client?.debounceSend('role_getroleinfo', {})
      gameLogger.debug('已请求更新角色信息')
    } catch (error) {
      gameLogger.error('请求角色信息更新失败:', error)
    }
  });
}