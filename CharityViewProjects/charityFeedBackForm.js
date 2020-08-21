import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import { Col } from 'react-bootstrap';
import { Bert } from 'meteor/themeteorchef:bert';
import StarRatings from 'react-star-ratings';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import Style from '../UserDashboardProjects/style';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';
import { prepareKeyDeliverablesForInput } from '../CharityProjects/utils'
import './style.css';

class CharityFeedBackForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      feedbackToSend: { rating: 0, feedback: '' },
      feedbackReceived: { rating: 0, feedback: '' },
      charityFeedbackSubmitted: false,
      nofeedbackReceived: true,
      preDataAvailable: false,
      editMode: false,
      loggedInUser: Meteor.user(),
      reviewProjectWithData: [],
      feedbackGivenByVolunteer: false
    };
  }

  changeRating = (newRating) => { this.setState((prevState) => ({ feedbackToSend: { ...prevState.feedbackToSend, rating: newRating } })) };

  //react lifecycle method
  componentDidMount() { this.getFeedback(); }

  getFeedback = () => {
    const projectId = this.props.projectData._id;

    Meteor.call('getFeedback', projectId, (err, res) => {
      if (!err) {
        if (res.length > 0) {
          let feedbackByCharity = res.find((data) => data.givenBy === 'charity') || false;
          let feedbackByVolunteer = res.find((data) => data.givenBy === 'volunteer') || false;
          let feedbackByEmployeeVolunteer = res.find((data) => data.givenBy === 'employeeVolunteer') || false;

          let response = {};
          if (feedbackByVolunteer) { response.feedbackReceived = feedbackByVolunteer; response.nofeedbackReceived = false; this.setState({ feedbackGivenByVolunteer: true }) }
          if (feedbackByEmployeeVolunteer) { response.feedbackReceived = feedbackByEmployeeVolunteer; response.nofeedbackReceived = false; this.setState({ feedbackGivenByVolunteer: true }) }
          else if (!feedbackByVolunteer) { response.nofeedbackReceived = true; }



          if (feedbackByCharity) { response.feedbackToSend = feedbackByCharity; response.preDataAvailable = true; }
          else if (!feedbackByCharity) { response.preDataAvailable = false; }
          response.editMode = false;
          this.setState(response);
        }
      }
    });


    let obj = {};
    obj.volId = this.props.reviewWorkVolunteerId;
    obj.projId = this.props.projectData._id;
    Meteor.call("getReviewDetails", (obj), (err, res) => { if (!err) { this.setState({ reviewProjectWithData: res }) } })
  };

  /**
   * handle the textarea field in review page, here chaity will
   * provide review on uploaded work of volunteer
   */

  holdTextarea = (e) => {
    e.persist();
    if (e.target.value.length < 501) { this.setState((prevState) => ({ feedbackToSend: { ...prevState.feedbackToSend, feedback: e.target.value } })) }
  };

  // Submit the feedback
  submitFeedback = () => {
    const { roles, _id } = this.state.loggedInUser;
    const { feedback, rating } = this.state.feedbackToSend;

    if (feedback.length === 0 || rating === 0) { Bert.alert('Feedback details required', 'danger'); }
    else {
      let obj = {};
      obj.feedback = feedback;
      obj.projectId = this.props.projectData._id;
      obj.userId = _id;
      obj.givenBy = roles[0];
      obj.rating = rating;

      if (this.state.editMode) {
        Meteor.call('updateFeedback', obj, (err) => {
          if (!err) {
            Bert.alert('Feedback for charity updated successfully', 'success');
            this.setState({ charityFeedbackSubmitted: true, preDataAvailable: true, editMode: false });
          }
        });
      } else {
        Meteor.call('createFeedback', obj, (err) => {
          if (!err) {
            Bert.alert('Feedback for charity submitted successfully', 'success');
            this.setState({ charityFeedbackSubmitted: true, preDataAvailable: true, editMode: false });
          }
        });
      }
    }
  };

  render() {
    const { backToDashboard, projectData } = this.props;
    const { charityFeedbackSubmitted, nofeedbackReceived, feedbackToSend, feedbackReceived, preDataAvailable, editMode, reviewProjectWithData } = this.state;
    return (
      <>
        <input type="button" value="&#60; Back to Projects" onClick={backToDashboard} className="backbtn-feedback" />
        <br />
        <br />
        <Style.innerWapper>
          <Col xs={12} md={4} className="rightBordered">
            <Tabstyle.col100_new className="col50">
              {reviewProjectWithData !== undefined &&
                reviewProjectWithData.map((prData) => {
                  let dateString = '';
                  let avatarImage = '';
                  let templateTitle = 'NA';
                  if (prData.projectData !== undefined) {
                    const date1 = new Date(prData.projectData.deadline);
                    dateString = `${date1.toLocaleDateString('en-US', { month: 'short' })} 
                                ${date1.toLocaleDateString('en-US', { day: 'numeric', })},  
                                ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;

                    if (prData.org.coverImage) {
                      avatarImage = prData.org.coverImage;
                    }
                  }

                  if (
                    prData.templateInfo !== undefined &&
                    prData.templateInfo[0] !== undefined &&
                    prData.templateInfo[0].templateTitle
                  ) {
                    // eslint-disable-next-line prefer-destructuring
                    templateTitle = prData.templateInfo[0].templateTitle;
                  }
                  let userDesignationAndCompany = '';
                  if (prData.historyData !== undefined) {
                    const HistoryLength = prData.historyData.EmploymentHistory.length;
                    const dummyEmpHistory = prData.historyData.EmploymentHistory[HistoryLength - 1];
                    userDesignationAndCompany = <p className="designationAndCompany">{dummyEmpHistory['role'] !== undefined && dummyEmpHistory['role'] ? dummyEmpHistory['role'] + " at" : ""}  {dummyEmpHistory['company'] !== undefined && dummyEmpHistory['company'] ? dummyEmpHistory['company'] : ""}</p>
                  }

                  return (
                    <div className="projectBox_new">
                      <StyledTab.projectBanner>
                        <StyledTab.BannerOverlay className="BannerOverlay"> {avatarImage !== undefined ? <BackgroundReturn imagePath={avatarImage} /> : ""} </StyledTab.BannerOverlay>
                        <StyledTab.BannerCaption>
                          <div className="rightSectionOrgLogo">
                            {prData.org.avatar !== undefined && prData.org.avatar ? (prData.org.avatar !== undefined ? <AwatarReturn avatarImage={prData.org.avatar} /> : "") : ('NA')}
                          </div>

                          <div className="rightSectionProjectTitle">
                            <h2 className="topProjectTitle">{prData.projectData.title}</h2>
                            <StyledTab.projectlabelbox className="projectlabelbox">
                              {prData.cause !== undefined && prData.cause ? (<StyledTab.projectlabel className="colorBagni"> {prData.cause.name} </StyledTab.projectlabel>) : ('')}
                              {prData.skill !== undefined && prData.skill ? (<StyledTab.projectlabel2 style={{ background: prData.skill.color }}>  {prData.skill.name} </StyledTab.projectlabel2>) : ('')}
                            </StyledTab.projectlabelbox>
                          </div>

                        </StyledTab.BannerCaption>
                      </StyledTab.projectBanner>

                      <StyledTab.projectDetail className="projectDetail">
                        <StyledTab.projectHeading className="bottomProjectTitle">PROJECT DETAILS</StyledTab.projectHeading>


                        <ul className="projectDetailsBottomArea">
                          <li> <img src="/images/web-development.png" /> <p>{templateTitle}</p> </li>
                          <li> <img src="/images/time_tracking.png" /> <p>{prData.projectData.hours} hours over {prData.projectData.days} days</p> </li>
                          <li> <img src="/images/deadline.png" /> <p>Deadline: {dateString}</p> </li>
                        </ul>

                      </StyledTab.projectDetail>

                      <StyledTab.projectDetail className="projectDetail projectImpact_accept">
                        <StyledTab.projectHeading className="projectImpact_head">Project Impact</StyledTab.projectHeading>
                        <p>{prData.projectData.impactStatement}</p>
                      </StyledTab.projectDetail>

                      <StyledTab.projectDetail className="projectDetail projectInfo_accept">
                        <StyledTab.projectHeading className="projectInfo_head">PROJECT INFO</StyledTab.projectHeading>
                        <div className="imgNdHead">
                          <div className="img"><img src="/images/key_deliverables.png" /> </div>
                          <div className="text"> <p>Key Deliverables</p></div>
                        </div>

                        <br />
                        <ul>
                          {prData.projectData.keyDeliverables.map((key) => {
                            return <li>{key}</li>;
                          })}
                        </ul>
                        <br />
                      </StyledTab.projectDetail>

                      <div className="reviewProjectUserData">
                        <h2>SUBMITTED BY</h2>
                        {prData.user.profile.avatar !== undefined ? <AwatarReturn avatarImage={prData.user.profile.avatar} /> : ""}
                        <p>{prData.user.profile.firstName} {prData.user.profile.lastName}</p>
                        {userDesignationAndCompany}
                        <StarRatings rating={prData.userRating} starDimension="20px" starSpacing="0" starRatedColor="#F3DE6F" />
                      </div>
                    </div>
                  )
                })
              }

            </Tabstyle.col100_new>
          </Col>

          <Col xs={12} md={8}>
            {preDataAvailable ? (
              <Col xs={12} md={6}>
                <h1 className="heading-feedback">Review the volunteer</h1>
                <div className="star-rating-cont"> <StarRatings rating={feedbackToSend.rating} starDimension="40px" starRatedColor="rgb(242, 201, 76)" starHoverColor="rgb(242, 201, 76)" numberOfStars={5} /> </div>
                <div className="feedbackwork_give">
                  <label className="reviewwork_label"> Your Feedback <span>*</span> </label>
                  <p>{feedbackToSend.feedback}</p>
                  {
                    this.state.feedbackGivenByVolunteer ? "" :
                      <div className="reviewwork_counterhold"> {feedbackToSend.feedback.length} /500 </div>
                  }
                </div>
                {
                  this.state.feedbackGivenByVolunteer ? "" :
                    <input type="button" value="Edit" className="reviewwork_editwork" onClick={() => this.setState({ preDataAvailable: false, editMode: true })} />
                }

              </Col>
            ) : (
                <Col xs={12} md={6}>
                  <h1 className="heading-feedback">Review the volunteer</h1>
                  <div className="star-rating-cont">
                    <StarRatings rating={feedbackToSend.rating} starDimension="40px" starRatedColor="rgb(242, 201, 76)" starHoverColor="rgb(242, 201, 76)" changeRating={this.changeRating} numberOfStars={5} />
                  </div>

                  <div className="feedbackwork_give">
                    <label className="reviewwork_label"> Your Feedback <span>*</span> </label>
                    <p className="reviewwork_smalltext"> Describe your experience working on this project and what it was like working with this volunteer. </p>
                    <textarea className="reviewwork_textarea" value={feedbackToSend.feedback} onChange={(e) => this.holdTextarea(e)} />
                    <div className="reviewwork_counterhold"> {feedbackToSend.feedback.length} /500 </div>
                  </div>
                  <input type="button" value="SUBMIT" className="reviewwork_submitwork" onClick={this.submitFeedback} />
                </Col>
              )}

            <Col xs={12} md={6}>
              {nofeedbackReceived ? (
                <div className="section-two-feedback no-review">
                  <h1 className="heading-feedback">Volunteer’s Review of You</h1>
                  <div className="no-review-head">NO REVIEW YET</div>
                  <div className="feedbackwork_give"> <p> Looks like the volunteer hasn’t reviewed you yet. Check back soon to see their review. </p> </div>
                </div>
              ) : (
                  <>
                    <div className="section-two-feedback">
                      <h1 className="heading-feedback">Volunteer’s Review of You</h1>
                      {charityFeedbackSubmitted || preDataAvailable ? (
                        <>
                          <div className="star-rating-cont"> <StarRatings rating={feedbackReceived.rating} starDimension="40px" starRatedColor="rgb(242, 201, 76)" starHoverColor="rgb(242, 201, 76)" numberOfStars={5} /> </div>
                          <div className="feedbackwork_give">
                            <label className="reviewwork_label"> Their Feedback <span>*</span> </label>
                            <p> {feedbackReceived.feedback} </p>
                            <div className="reviewwork_counterhold" />
                          </div>
                        </>
                      ) : (
                          <div className="no-feedback">
                            <p> You need to review the volunteer before you can download the finished asset and see their review </p>
                            <p> You need to review the volunteer before you can download the finished asset and see their review </p>
                          </div>
                        )}
                    </div>
                    {charityFeedbackSubmitted || preDataAvailable ? <></> : <div className="feedback-overlay" />}
                  </>
                )}
            </Col>
          </Col>
        </Style.innerWapper>
      </>
    );
  }
}
CharityFeedBackForm.propTypes = {};
CharityFeedBackForm.defaultProps = {};
export default CharityFeedBackForm;