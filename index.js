const sharp = require("sharp");
const async = require("async");
let imagePath = "./test.jpg";
let start = new Date().getTime();
let image = sharp(imagePath);
image.metadata().then(function (metadata) {
    let imgHeight = metadata.height; // 이미지 높이
    let imgWidth = metadata.width; // 이미지 넓이
    let blankWidth = imgWidth * 0.8; // 배경&버튼 인지 확인할 넓이
    let blankLeft = imgWidth * 0.1; // 위의 판단에 포함시키지 않을 좌측 여백
    // 커질수록 퍼포먼스가 빨라짐
    const blankHeight = 15; // 여백인지 확인할 높이 * 중간에 글자같은 컨텐츠가 존재할 경우 평균값이 min, max 과 달라져서 너무 크게 잡으면 인식이 불가하다
    let i = 0;
    let topPosition = 0;
    let lastTone = -1; // 초기값 -1 인 경우 무조건 설정되며 그 뒤로는 마지막 배경색을 저장한다
    let rgbInterval = 15;
    async.whilst(
        function check(cb) { //반복실행 조건
            cb(null, i < imgHeight - blankHeight);
        },
        function proc(cb) { //처리
            console.log(`Search image lastTone : ${lastTone} x : ${blankLeft} y : ${i} w : ${blankWidth} h : ${blankHeight}`);
            let areaInfo = { left: blankLeft, top: i, width: blankWidth, height: blankHeight };
            image.extract(areaInfo).toBuffer((err, data, info) => {
                if (err) {
                    console.log(areaInfo);
                    throw new Error(err);
                }
                sharp(data).stats().then(({ channels: [rc, gc, bc] }) => {
                    // RGB 평균값과 배경인지 컨텐츠가 포함된 내용인지 평균값과 min max 값을 비교한다
                    const r = Math.round(rc.mean), g = Math.round(gc.mean), b = Math.round(bc.mean);

                    let isBackground = false; // 현재 체크중인 이미지 영역이 배경인지 아닌지 여부

                    // min max 가 비슷하면(오차 rgb 5) 단순 배경이 blankHeight 높이로 연속된 것으로 인지
                    if ((rc.min + rgbInterval >= rc.max) &&
                        (gc.min + rgbInterval >= gc.max) &&
                        (bc.min + rgbInterval >= bc.max)) {
                        isBackground = true;
                    }
                    if(isBackground) {
                        if(lastTone == -1) {
                            lastTone = rc.max + gc.max + bc.max;
                        } else if(lastTone == -1 && (lastTone - (rgbInterval*3) > (rc.max + gc.max + bc.max) || lastTone + (rgbInterval*3) < (rc.max + gc.max + bc.max))) {
                            // 배경이 이전 배경과 달라진 지점 서치
                            console.log(`이전과 다른 배경이 찾아진 높이 : ${i}`);
                            lastTone = (rc.max + gc.max + bc.max);
                            let extractHeight = i - topPosition;
                            if (extractHeight > 40) { // 40 픽셀보다 커야 의미있는 이미지
                                let option = { left: 0, top: topPosition, width: imgWidth, height: extractHeight };
                                console.log(option);
                                image.extract(option).clone().toFile(i + "-split.jpg");
                                cb();
                                topPosition = i;
                                return;
                            }
                        }
                    }
                    if(isBackground)
                        i += blankHeight;
                    else
                        i += 5;
                    // 마지막 이미지 자름
                    if(i >= imgHeight - blankHeight) {
                        let extractHeight = imgHeight - topPosition;
                        let option = { left: 0, top: topPosition, width: imgWidth, height: extractHeight };
                        console.log(option);
                        image.extract(option).clone().toFile(i + "-split.jpg");
                    }
                    cb();
                });
            });
            // }).clone().toFile(i + ".jpg"); // 디버깅용 이미지 저장
        },
        function done(err) { //루프 종료시
            console.log("done");
            let end = new Date().getTime();
            console.log((end - start) / 1000);
        }
    );
});