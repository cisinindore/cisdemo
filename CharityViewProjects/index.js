import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import { Col, Pagination } from 'react-bootstrap';
import Popup from 'reactjs-popup';
import { Bert } from 'meteor/themeteorchef:bert';
import CharityDashboardCommon from '../CharityDashboardCommon';
import CharityDashboardCommonSecondPart from '../CharityDashboardCommon/partialRightSections';
import ApplicantsWindow from './applicantsWindow';
import ReviewVolunteerWork from './reviewVolunteerWork';
import ViewVolunteer from './viewVolunteerProfile';
import OpenToApplicants from './openToApplicantTab';
import CharityCompletedProjects from './completedProjects';
import AwatarReturn from '../../components/AwsImageDisplay';
import BackgroundReturn from '../../components/AwsCharityCoverImage';
import Style from '../UserDashboardProjects/style';
import styles from '../UserDashboardProjects/style.module.css';
import StyledTab from '../BrowseProject/style';
import Tabstyle from '../Tabs/style';

import './style.css';
import CharityFeedBackForm from './charityFeedBackForm';

class CharityViewProjects extends Component {
  constructor() {
    super();
    this.state = {
      myProjects: [],
      applicantsWindow: false,
      myOrganisation: [],
      openedTab: '1',
      openUserProfile: false,
      reviewWindwoOpen: false,
      feedBackWindowOpen: false,
      feedbackData: {},
      currentOffset: 1,
      reviewWorkVolunteerIdFro:0
    };
  }

  /**
   *  lifecycle method of react which run
   *  immediatly after component get mount
   */

  componentDidMount() {
    Meteor.call('getCharityProjects', (error, response) => { if (!error) {this.setState({ myProjects: response }); }  });

    //if user is not a charity redirect
    Meteor.call('getAuthorInfo', (error, response) => {
      if (!error) {
        if (response[0].roles[0] !== 'charity') {  this.props.history.push('/dashboard'); }
        this.setState({ clientRemainingPoints: response[0].projectPoints, thisUserId: response[0]._id });
      }
    });

    //this function return all the data of my charity if i am logged in as a charity user
    Meteor.call('getMyOrganisation', (error, response) => {
      if (response.length === 0) { Bert.alert( 'No data found for Charity. Please edit profile and insert some', 'danger', 'fixed-top', ); }
      if (!error) { this.setState({ myOrganisation: response }); }
    });

    const { search } = window.location;
    const params = new URLSearchParams(search);
    const foo = params.get('tab');
    if (foo !== undefined && foo) { this.setState({ openedTab: foo }); }

    this.getActiveApplicantProjects();
  }


  //get projects of charity which are open for applicants
  getActiveApplicantProjects = () => {
    Meteor.call('getCharityOpenToApplicantsProjects', (this.state.currentOffset), (error, response) => { if (!error) { this.setState({ myActiveProjects: response }); }});
    Meteor.call('getCharityOpenToApplicantsProjectsLength', (error, response) => { if (!error) {  this.setState({ myActiveProjectsLength: response }); } });

  }

  //function to render page numbers in pagination
  renderNumbers = () => {
    let items = [];
    var totalPages = Math.ceil(this.state.myActiveProjectsLength / 4);
    for (let number = 1; number <= totalPages; number++) {
      items.push( <Pagination.Item key={number} onClick={() => this.handlePageNumber(number)} className={this.state.currentOffset === number ? 'activeclass' : 'pageItem'}> {number}</Pagination.Item>);
    }
    return items;
  }

  //handle page number function for pagination
  handlePageNumber(number) {
    this.setState({ currentOffset: number }, () => {
      const countValue = this.state.currentOffset;
      Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => { this.setState({ myActiveProjects: response }) });
    });
  }

  //pagination prev page functions
  handlePrevPage() {
    if (this.state.currentOffset > 1) {
      this.setState({ currentOffset: this.state.currentOffset - 1 }, () => {
        const countValue = this.state.currentOffset;
        Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => {  this.setState({ myActiveProjects: response }); });
      });
    }


  }

  handleNextPage() {
    let numArray = this.renderNumbers()
    let finalPageCount = numArray.length;

    if (finalPageCount > this.state.currentOffset) {
      this.setState({currentOffset: this.state.currentOffset + 1}, () => {
        const countValue = this.state.currentOffset;
        Meteor.call('getCharityOpenToApplicantsProjects', countValue, (err, response) => { this.setState({ myActiveProjects: response }); });
      });
    }
  }

  /**
   *  lifecyvle method of react which run
   *  when new data get found in component
   */
  componentWillReceiveProps() {
    const { search } = window.location;
    const params = new URLSearchParams(search);
    const foo = params.get('tab');
    if (foo !== undefined && foo) { this.setState({ openedTab: foo })}
  }

  /**
   *  Holding the logic to handle the review submission window with funciton
   */
  reviewSubmission = (volunteerWorkReview, projectWorkReview) => {
    this.setState({ reviewWorkVolunteerId: volunteerWorkReview, reviewWorkProjectId: projectWorkReview, reviewWindwoOpen: true, });
  };

  //close view profile popup
  closeModalViewProfile = () => {this.setState({ openUserProfile: false }); };


  //this function open popup with user info, when charity click to view profile of assigned user
  openUserPopup = (userId) => { if (userId) { this.setState({ viewProfileUser: userId, openUserProfile: true, }); } };

  /**
   * This function reset the state redirect
   * the view to original listing layout
   */
  getBackToPage = () => {
    this.setState({ applicantsWindow: false });
    Meteor.call('getCharityProjects', (error, response) => { if (!error) { this.setState({ myProjects: response }); } });
  };

  getBackToView = (condition) => {
    this.setState({ [condition]: false });
    Meteor.call('getCharityProjects', (error, response) => {  if (!error) { this.setState({ myProjects: response }); } });
  };

  /**
   * This function is responsible for handling
   * The data of applicant list window
   */
  handleApplicantsWindow = (data, orgLogo, coverImage, causes, skills, templateTitle) => {
    if (data) { this.setState({  applicantsPagedata: data, thiOrgLogo: orgLogo, thisOrgCover: coverImage, applicantsWindow: true, causesSend: causes, skillSend: skills,        templateTitle: templateTitle }); }
  };

  /**
   * This function show hide the tabs based on condition
   */
  handleTabs = (e) => {
    const { history } = this.props;
    this.setState({ openedTab: e.target.id });

    if (e.target.id === '1') { history.push('/charity-projects?tab=1'); }
    if (e.target.id === '2') { history.push('/charity-projects?tab=2'); }
    if (e.target.id === '3') { history.push('/charity-projects?tab=3'); }
    if (e.target.id === '4') { history.push('/charity-projects?tab=4'); }
  };

  /**
   * if a project is already assigned to a volunteer and that volunteer not activated the project
   * then when a charity admin click to check the applicant list, then this notification display to notify
   */
  displayNotification = () => {
    Bert.defaults = { hideDelay: 4000, style: 'fixed-top' };
    Bert.alert('Already assigned to a volunteer, Volunteer has 2 weeks to active the project, after that you will get notification!', 'success');
  };

 //this functions set related state and move page to the feedback provide page
 feedbackSubmission = (data) => {
  this.setState({ feedBackWindowOpen: true, feedbackData: data.projectData, reviewWorkVolunteerIdFro: data.workHistory.volunteerId, projectId: data.projectData._id });
};

  render() {
    const { history } = this.props;
    let assignedProject = 0;
    let inReviewProject = 0;


    return (
      <div>
        {this.state.applicantsPagedata !== undefined && this.state.applicantsWindow === true ? (
          <ApplicantsWindow  history={history} getBackToPage={this.getBackToPage}  projectData={this.state.applicantsPagedata}  thiOrgLogo={this.state.thiOrgLogo}  thisOrgCover={this.state.thisOrgCover}  thisProCat={this.state.thisProCat}  tihsProjSubCat={this.state.tihsProjSubCat}  causesSend={this.state.causesSend}  skillSend={this.state.skillSend}  templateTitle={this.state.templateTitle} />
        ) : this.state.feedBackWindowOpen ? ( <CharityFeedBackForm history={history}  backToDashboard={() => this.getBackToView('feedBackWindowOpen')} projectData={this.state.feedbackData} reviewWorkVolunteerId={this.state.reviewWorkVolunteerIdFro} />)
          : this.state.reviewWorkVolunteerId !== undefined &&
            this.state.reviewWorkProjectId !== undefined &&
            this.state.reviewWindwoOpen === true ? (
                <ReviewVolunteerWork history={history} getBackToView={() => this.getBackToView('reviewWindwoOpen')} reviewWorkVolunteerId={this.state.reviewWorkVolunteerId} reviewWorkProjectId={this.state.reviewWorkProjectId}/>
              ) : (
                <Style.innerWapper>
                  <CharityDashboardCommon history={history} />
                  <Style.rightcontent className="rightcontent">
                    <Style.banner className={styles.banner}>
                      <Style.bannerIn className={styles.bannerIn} style={{ height: '180px' }}> <img src="/images/projectBg.png" alt="" /> </Style.bannerIn>
                      <Style.bannerCaption>
                        <Style.bannerHeading>projects</Style.bannerHeading>
                        {/* <div className="top-info-bar">You can create <span>{this.state.clientRemainingPoints !== undefined ? this.state.clientRemainingPoints: '0'} projects</span> before you need to buy more.
                          <input  className="view-plan-link" type="button" onClick={() => history.push('/plans')} value="View project packages" />
                        </div> */}
                      </Style.bannerCaption>
                    </Style.banner>

                    <CharityDashboardCommonSecondPart history={history} />

                    <Style.desktopTabs className="desktoptabs">
                      <Col xs={12} md={12} className="">
                        <ul className="inner-tabs-holder">
                          <li className={this.state.openedTab === '1' ? 'activeTab' : ''}>
                            <input
                              type="button"
                              value="OPEN TO APPLICANTS"
                              onClick={(e) => this.handleTabs(e)}
                              id="1"
                              className={this.state.openedTab === '1' ? 'activeTab' : ''}
                            />
                          </li>
                          <li className={this.state.openedTab === '2' ? 'activeTab' : ''}>
                            <input
                              type="button"
                              value="ASSIGNED"
                              onClick={(e) => this.handleTabs(e)}
                              id="2"
                              className={this.state.openedTab === '2' ? 'activeTab' : ''}
                            />
                          </li>
                          <li className={this.state.openedTab === '3' ? 'activeTab' : ''}>
                            <input
                              type="button"
                              value="REVIEW"
                              onClick={(e) => this.handleTabs(e)}
                              id="3"
                              className={this.state.openedTab === '3' ? 'activeTab' : ''}
                            />
                          </li>
                          <li className={this.state.openedTab === '4' ? 'activeTab' : ''}>
                            <input
                              type="button"
                              value="COMPLETED"
                              onClick={(e) => this.handleTabs(e)}
                              id="4"
                              className={this.state.openedTab === '4' ? 'activeTab' : ''}
                            />
                          </li>
                        </ul>
                      </Col>

                      <Col xs={12} md={12} className="tabs-content">
                        <Tabstyle.tabContainer className="tabContainer">
                          <Tabstyle.tabRow className="tabInnerparts">

                            {this.state.openedTab === '1' ? ( <OpenToApplicants history={history} handleApplicantsWindow={this.handleApplicantsWindow} myOrganisation={this.state.myOrganisation}/>) : ("") }
                            {/* Content ended for "open to applicant tab" */}

                            {this.state.openedTab === '2'  ? this.state.myProjects !== undefined && this.state.myProjects.map((data) => {
                                if ( data.workHistory !== undefined &&  (data.workHistory.workStatus === 4 || data.workHistory.workStatus === 0)) {
                                  let avatarImage = "";{this.state.myOrganisation.map((data1) => { if (data1.coverImage) { avatarImage = data1.coverImage;}})}
                                  assignedProject += 1;
                                  return (
                                    <Tabstyle.col50 className="col50" key={assignedProject}>
                                      <StyledTab.projectBox className="projectBox">
                                        <StyledTab.projectBanner>
                                          <StyledTab.BannerOverlay className="BannerOverlay">
                                            { avatarImage !== undefined  ? <BackgroundReturn imagePath={avatarImage}/> : "" }
                                          </StyledTab.BannerOverlay>

                                          <StyledTab.BannerCaption>
                                            <StyledTab.bannerLogo className="bannerLogo">
                                              {this.state.myOrganisation !== undefined && this.state.myOrganisation[0] !== undefined ? ( this.state.myOrganisation[0].avatar !== undefined  ? <AwatarReturn avatarImage={this.state.myOrganisation[0].avatar}/> : ""  ) : ('NA')}
                                            </StyledTab.bannerLogo>

                                            <StyledTab.projectlabelbox className="projectlabelbox">
                                              {data.cause !== undefined && data.cause ? (<StyledTab.projectlabel className="colorBagni">{data.cause.name}</StyledTab.projectlabel>) : ('')}
                                              {data.skill !== undefined && data.skill ? ( <StyledTab.projectlabel2  style={{ background: data.skill.color }} > {data.skill.name}</StyledTab.projectlabel2>) : ('')}
                                            </StyledTab.projectlabelbox>
                                          </StyledTab.BannerCaption>
                                        </StyledTab.projectBanner>

                                        <StyledTab.projectDetail className="projectDetail">
                                          <StyledTab.projectHeading> {data.projectData.title} </StyledTab.projectHeading>

                                          <div>
                                            {data.assignedUser !== undefined &&
                                              data.assignedUser.map((userHere) => {
                                                let name = '';
                                                let avatar = '';
                                                if (userHere.profile.firstName !== undefined) {  name = ( <p className="userNameInner"> {userHere.profile.firstName} {userHere.profile.lastName} </p> ); }
                                                if (userHere.profile.avatar !== undefined) { avatar = userHere.profile.avatar }

                                                return (
                                                  <div className="assignedUserHolderForCharity">
                                                    <div className="userImage"> { avatar !== undefined  ? <AwatarReturn avatarImage={avatar}/> : "" } </div>
                                                    <div className="userName"> ASSIGNED TO:<br /> {name} </div>
                                                    <div className="assignedUserBtnHolder">
                                                      <input type="button"  value="VIEW PROFILE" onClick={() => this.openUserPopup(userHere._id)} />
                                                      <input type="button"  value="CONTACT" onClick={() => history.push('/messages')} />
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        </StyledTab.projectDetail>
                                      </StyledTab.projectBox>
                                    </Tabstyle.col50>
                                  );
                                }
                                return true;
                              })
                              : ''}

                            {this.state.openedTab === '2' && assignedProject === 0 ? ( <h3 className="noProjectFound" style={{ textAlign: 'center' }}>  No Project Found </h3> ) : ( '' )}

                            {/* Content ended for assigned project tab */}

                            {this.state.openedTab === '3'
                              ? this.state.myProjects !== undefined &&
                              this.state.myProjects.map((data) => {
                                if ( data.workHistory !== undefined && data.workHistory.workStatus === 1 ) {
                                  let avatarImage = "";{ this.state.myOrganisation.map((data1) => { if (data1.coverImage) {avatarImage = data1.coverImage;} }) }
                                  inReviewProject += 1;
                                  const date1     = new Date(data.projectData.deadline);
                                  const date2     = new Date();
                                  const diffTime  = Math.abs(date2 - date1);
                                  const DifferenceInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                  const dateString = `${date1.toLocaleDateString('en-US', { day: 'numeric', })} 
                                                      ${date1.toLocaleDateString('en-US', { month: 'short', })} 
                                                      ${date1.toLocaleDateString('en-US', { year: 'numeric' })}`;

                                  return (
                                    <Tabstyle.col50 className="col50" key={inReviewProject}>
                                      <StyledTab.projectBox className="projectBox">
                                        <StyledTab.projectBanner>
                                          <StyledTab.BannerOverlay className="BannerOverlay"> { avatarImage !== undefined  ? <BackgroundReturn imagePath={avatarImage}/> : "" } </StyledTab.BannerOverlay>

                                          <StyledTab.BannerCaption>
                                            <StyledTab.bannerLogo className="bannerLogo">
                                              {this.state.myOrganisation !== undefined && this.state.myOrganisation[0] !== undefined ? (
                                                  this.state.myOrganisation[0].avatar !== undefined  ? <AwatarReturn avatarImage={this.state.myOrganisation[0].avatar}/> : ""
                                                ) : ( 'NA' )}
                                            </StyledTab.bannerLogo>

                                            <StyledTab.projectlabelbox className="projectlabelbox">
                                              {data.cause !== undefined && data.cause ? (  <StyledTab.projectlabel className="colorBagni">  {data.cause.name} </StyledTab.projectlabel> ) : ( '' )}
                                              {data.skill !== undefined && data.skill ? ( <StyledTab.projectlabel2  style={{ background: data.skill.color }} >  {data.skill.name} </StyledTab.projectlabel2> ) : ('')}
                                            </StyledTab.projectlabelbox>
                                          </StyledTab.BannerCaption>
                                        </StyledTab.projectBanner>

                                        <StyledTab.projectDetail className="projectDetail">
                                          <StyledTab.projectHeading> {data.projectData.title} </StyledTab.projectHeading>

                                          <StyledTab.projectHeadinglabel>
                                            {this.state.myOrganisation[0] !== undefined && this.state.myOrganisation[0].title !== undefined ? this.state.myOrganisation[0].title : ''}
                                          </StyledTab.projectHeadinglabel>

                                          <StyledTab.projecHrlabel>{data.projectData.hourRequired} | Deadline {dateString}</StyledTab.projecHrlabel>
                                        </StyledTab.projectDetail>

                                        <Tabstyle.projectStaus>
                                          {data.workHistory !== undefined &&  data.workHistory.workStatus !== undefined && data.workHistory.workStatus === 1 ? (
                                              <ul className="progressbar charityReviewbar">
                                                <li className="done"> <span>Assigned</span> </li>
                                                <li className="active"> <span>in review</span> </li>
                                                <li> <span>Completed</span> </li>
                                              </ul>
                                            ) : ('') }
                                        </Tabstyle.projectStaus>

                                        <h6 className="dueHead"> {DifferenceInDays >= 0 ? 'Due in' : ''} </h6>
                                        <Tabstyle.dayscount>
                                          <h1> {DifferenceInDays >= 0 ? DifferenceInDays : 'Expired'} </h1>
                                          <span>{DifferenceInDays >= 0 ? 'days' : ''}</span>
                                          <p>{dateString}</p>
                                        </Tabstyle.dayscount>

                                        <Tabstyle.styledbtn>
                                          <button type="button" className="btnFull" onClick={() => this.reviewSubmission( data.workHistory.volunteerId, data.workHistory.projectId, ) } > REVIEW SUBMISSION </button>
                                        </Tabstyle.styledbtn>

                                        <Tabstyle.styledbtn>
                                          <button type="submit" className="btnHalf"> View Project </button>
                                          <button type="submit" className="btnHalf" onClick={() => history.push('/messages')} > Contact </button>
                                        </Tabstyle.styledbtn>
                                        <br />
                                      </StyledTab.projectBox>
                                    </Tabstyle.col50>
                                  );
                                }
                                return true;
                              })
                              : ''}

                            {this.state.openedTab === '3' && inReviewProject === 0 ? (
                              <h3 className="noProjectFound" style={{ textAlign: 'center' }}>
                                No Project Found
                        </h3>
                            ) : (
                                ''
                              )}

                            {/* content ended for review tab */}
                            { this.state.openedTab === '4' ? (<CharityCompletedProjects myOrganisation = {this.state.myOrganisation} history={history} feedbackSubmission={(data)=> this.feedbackSubmission(data)} thisUserId={this.state.thisUserId}/>) : ''}
                          </Tabstyle.tabRow>
                        </Tabstyle.tabContainer>
                      </Col>
                    </Style.desktopTabs>
                  </Style.rightcontent>

                  {/* popup for view user on assigned tab */}
                  <Popup open={this.state.openUserProfile} onClose={this.closeModalViewProfile} style={{ /* width: '320px', */ padding: '15px' }} className="viewprofile_applicantPop" >
                    <ViewVolunteer volunteerid={this.state.viewProfileUser}  onClose={this.closeModalViewProfile} />
                  </Popup>
                </Style.innerWapper>
              )}
      </div>
    );
  }
}
CharityViewProjects.propTypes = {
  history: PropTypes.object.isRequired,
};
export default CharityViewProjects;
